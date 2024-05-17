import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from '@aws-cdk/aws-lambda-python-alpha';
import { bedrock } from '@cdklabs/generative-ai-cdk-constructs';
import * as path from 'path';

export class BedrockBlockchainDataAgentStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const agent = new bedrock.Agent(this, 'Agent', {
      foundationModel: bedrock.BedrockFoundationModel.ANTHROPIC_CLAUDE_INSTANT_V1_2,
      instruction: 'You are a SQL developer that creates queries for Amazon Athena. You are allowed to return data and Amazon Athena queries when requested. You will use the schema tables provided here {athena_schema} to create queries for the Athena database like {athena_example}. Return responses exactly how they are fetched. Be friendly in every response.',
      
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
      handler: 'index.lambda_handler',
      timeout: cdk.Duration.seconds(300),
      environment: { // Optional: Set environment variables for the function
        ATHENA_QUERY_RESULTS_BUCKET_NAME: athenaBucket.bucketName,
      },
    });

    const lambdaRole = actionGroupFunction.role;
    athenaBucket.addToResourcePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        principals: [new iam.ServicePrincipal('lambda.amazonaws.com')],
        actions: ['s3:PutObject', 's3:GetObject'],
        resources: [`${athenaBucket.bucketArn}/*`],
      })
    );
    
    const actionGroup = new bedrock.AgentActionGroup(this,'MyActionGroup',{
      actionGroupName: 'query-athena-cdk',
      description: 'Uses Amazon Athena with s3 data source that contains bitcoin and ethereum data',
      actionGroupExecutor: actionGroupFunction,
      actionGroupState: "ENABLED",
      apiSchema: bedrock.ApiSchema.fromAsset(path.join(__dirname, '../athena-schema.json')),
    });
    
    agent.addActionGroup(actionGroup);

  }
}
