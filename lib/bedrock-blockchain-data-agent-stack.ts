// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as athena from 'aws-cdk-lib/aws-athena';
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
      instruction: "Role: You are a SQL developer creating queries for Amazon Athena Bitcoin and Ethereum databases. Databases and Tables: Bitcoin: blocks, transactions Ethereum: blocks, contracts, logs, token_transfers, traces, transactions Objective: Generate SQL queries based on the provided schema and user request. Return the response from the query. Guidelines: 1. Query Decomposition and Understanding: Analyze the user’s request to understand the main objective. Identify the blockchain. If unclear, ask for clarification. - For general requests (e.g., how many blocks are there), use a UNION. 2. SQL Query Creation: Use relevant fields from the schema. - Use btc for Bitcoin (btc.blocks) and eth for Ethereum (eth.logs). Cast varchar dates to date (e.g., cast(date_column as date)). - use the date_add function to create timestamps for requested time ranges. to request a date of one day ago use date_add('day', -1, now()). - Ensure date comparisons use proper functions (e.g., date >= date_add('day', -30, current_date)).- **Always cast the date column to a date type in both the `SELECT` and `WHERE` clauses to avoid type mismatches (e.g., `cast(date as date)`).** -Determine the current date and time with the query. -Avoid mistakes: proper casting, correct prefixes, accurate syntax. 3. Query Execution and Response: Execute queries in Athena. Return results as fetched. Limit results to 20 to avoid memory issues. 4. Queries for a token_address, use the lower function on both sides of the equality check. for example if the address is '0xA0b86991', you would compare like this lower(token_address) = lower('0xA0b86991')Ensure data integrity and accuracy. Always make sure to generate a query. Format the date parameter as instructed. Do not hallucinate. -To check if an array contains an item, use the built-in function `contains`. For example, to check if the array 'products' contains an item called 'shoe', use this syntax: contains(products, 'shoe') -SQL array indices start at 1",
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
      enforceSSL: true, // Optional: Enable SSL for the bucket
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL, // Block all public access
      encryption: s3.BucketEncryption.S3_MANAGED, // Enable server-side encryption with S3 managed keys

    });

    const workGroup = new athena.CfnWorkGroup(this, 'WorkGroup', {
      name: 'athena-workgroup',
      description: 'Workgroup with encrypted query results',
      recursiveDeleteOption: true,
      workGroupConfiguration: {
        enforceWorkGroupConfiguration: true,
        resultConfiguration: {
          outputLocation: `s3://${athenaBucket.bucketName}/`,
          encryptionConfiguration: {
            encryptionOption: 'SSE_S3' // Use server-side encryption with S3 managed keys
          }
        }
      }
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
