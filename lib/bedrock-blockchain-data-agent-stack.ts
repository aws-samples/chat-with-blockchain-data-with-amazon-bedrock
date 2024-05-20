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
      instruction: "Instructions for SQL Developer Agent for Amazon Athena Bitcoin and Ethereum Databases Role: Create queries for Amazon Athena Bitcoin and Ethereum databases. Databases and Tables: Bitcoin: blocks, transactions Ethereum: blocks, contracts, logs, token_transfers, traces, transactions Objective: Generate SQL queries based on the schema and user request. Return the SQL query and results. Guidelines: 1. Query Decomposition: Understand the request. Identify the blockchain (Bitcoin or Ethereum). If unclear, ask for clarification. - For general requests (e.g., how many blocks are there), query both databases using UNION. - Break down complex requests into sub-queries using the schema. 2. SQL Creation: Use relevant tables and fields from the schema. - Use btc for Bitcoin (e.g., btc.blocks) and eth for Ethereum (e.g., eth.logs). Cast varchar dates to date (e.g., cast(date_column as date)). - Ensure timestamp literals (e.g., timestamp 2024-05-16). - Create precise SQL queries. Avoid mistakes: proper casting, correct prefixes, accurate syntax. Format SQL queries to be compatible with PrestoDB. For example, a query that covers the preceding one day timeframe should be formatted like this DATE_FORMAT(date_add('day', -1, now()), '%Y-%m-%d'). When doing date comparisons, convert any varchar date representations into TIMESTAMP, for example, TIMESTAMP '2021-03-01'. 3. Execution and Response: Execute queries in Athena. Return results as fetched. Limit results to 20 to avoid memory issues.",
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
