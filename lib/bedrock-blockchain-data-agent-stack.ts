import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from '@aws-cdk/aws-lambda-python-alpha';
import { bedrock } from '@cdklabs/generative-ai-cdk-constructs';
import * as path from 'path';
import { CfnInclude } from 'aws-cdk-lib/cloudformation-include';
import { readFileSync } from 'fs';

export class BedrockBlockchainDataAgentStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);
    const orchestration = readFileSync('lib/prompts/orchestration.txt', 'utf-8');
    const agent = new bedrock.Agent(this, 'Agent', {
      foundationModel: bedrock.BedrockFoundationModel.ANTHROPIC_CLAUDE_HAIKU_V1_0,
      shouldPrepareAgent: true,
      enableUserInput: true,
      instruction: "Role: Create queries for Amazon Athena Bitcoin and Ethereum databases. Databases and Tables: Bitcoin: blocks, transactions Ethereum: blocks, contracts, logs, token_transfers, traces, transactions Objective: Generate SQL queries based on the schema and user request. Guidelines: 1. Query Decomposition: Understand the request. Identify the blockchain. If unclear, ask for clarification. - For general requests (e.g., how many blocks are there), use a UNION. 2. SQL Creation: Use relevant fields from the schema. - Use btc for Bitcoin (btc.blocks) and eth for Ethereum (eth.logs). Cast varchar dates to date (e.g., cast(date_column as date)). - use the date_add function to create timestamps for requested time ranges. for example, to request a date of one day ago use date_add('day', -1, now()). -Avoid mistakes: proper casting, correct prefixes, accurate syntax. Format SQL queries to be compatible with PrestoDB. 3. Execution and Response: Execute queries in Athena. Return results as fetched. Limit results to 20 to avoid memory issues. 4. When querying for specific addresses, use a lower case comparison, eg lower(address) = lower('0xA0b86991c621')",
      promptOverrideConfiguration: {
        promptConfigurations: [
          {
            promptType: bedrock.PromptType.ORCHESTRATION,
            basePromptTemplate: orchestration,
            promptState: bedrock.PromptState.ENABLED,
            promptCreationMode: bedrock.PromptCreationMode.OVERRIDDEN,
            inferenceConfiguration: {
              temperature: 0.0,
              topP: 1,
              topK: 250,
              maximumLength: 2048,
              stopSequences: ['</invoke>', '</answer>', '</error>'],
            },
          },
        ]
      }
    });


    const athenaBucket = new s3.Bucket(this, 'AthenaQueryResultsBucket', {
      // bucketName: 'XXXXXXXXXXXXXX', // Optional: Specify a bucket name
      removalPolicy: cdk.RemovalPolicy.DESTROY, // Optional: Specify the removal policy for the bucket
      autoDeleteObjects: true, // Optional: Automatically delete objects when the bucket is deleted
      versioned: true, // Optional: Enable versioning for the bucket
      // Add any additional bucket properties or configurations here
    });


    const actionGroupFunction = new lambda.PythonFunction(this, 'ActionGroupFunction', {
      runtime: cdk.aws_lambda.Runtime.PYTHON_3_12,
      entry: path.join(__dirname, './lambda/bedrock-agent-txtsql-action'),
      handler: 'lambda_handler',
      timeout: cdk.Duration.seconds(300),
      environment: { // Optional: Set environment variables for the function
        ATHENA_QUERY_RESULTS_BUCKET_NAME: athenaBucket.bucketName,
      },
    });

    const lambdaRole = actionGroupFunction.role;
    lambdaRole?.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonS3FullAccess'));
    lambdaRole?.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonAthenaFullAccess'));

    athenaBucket.addToResourcePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        principals: [new iam.ServicePrincipal('lambda.amazonaws.com')],
        actions: ['s3:PutObject', 's3:GetObject'],
        resources: [`${athenaBucket.bucketArn}/*`],
      })
    );

    const actionGroup = new bedrock.AgentActionGroup(this, 'MyActionGroup', {
      actionGroupName: 'query-athena-cdk',
      description: 'Uses Amazon Athena with s3 data source that contains bitcoin and ethereum data',
      actionGroupExecutor: actionGroupFunction,
      actionGroupState: "ENABLED",
      apiSchema: bedrock.ApiSchema.fromAsset(path.join(__dirname, '../athena-schema.json')),
    });

    agent.addActionGroup(actionGroup);

    const nestedStack = new CfnInclude(this, 'NestedStack', {
      templateFile: path.join(__dirname, './aws-public-blockchain.yaml'),
    });
  }
}
