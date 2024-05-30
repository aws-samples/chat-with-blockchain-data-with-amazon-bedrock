#!/usr/bin/env node
// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { AwsSolutionsChecks, NagSuppressions } from 'cdk-nag';
import { BedrockBlockchainDataAgentStack } from '../lib/bedrock-blockchain-data-agent-stack';

const DEFAULT_CONFIG = {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,
  },
};

const app = new cdk.App();
const stack = new BedrockBlockchainDataAgentStack(app, 'BedrockBlockchainDataAgentStack', {
  /* If you don't specify 'env', this stack will be environment-agnostic.
   * Account/Region-dependent features and context lookups will not work,
   * but a single synthesized template can be deployed anywhere. */

  /* Uncomment the next line to specialize this stack for the AWS Account
   * and Region that are implied by the current CLI configuration. */
  // env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION },

  /* Uncomment the next line if you know exactly what Account and Region you
   * want to deploy the stack to. */
  // env: { account: '123456789012', region: 'us-east-1' },

  /* For more information, see https://docs.aws.amazon.com/cdk/latest/guide/environments.html */
});

cdk.Aspects.of(app).add(new AwsSolutionsChecks({ verbose: true }));

NagSuppressions.addStackSuppressions(stack, [
  { id: 'AwsSolutions-IAM5', reason: 'Permission to read CF stack is restrictive enough' },
  { id: 'AwsSolutions-IAM4', reason: 'AWS Managed Policy is sufficient for the resource' },
  { id: 'AwsSolutions-S1', reason: 'Access logs not required on the bucket' },
  { id: 'AwsSolutions-L1', reason: 'Lambda is using latest Python runtime, 3.12' },
  { id: 'AwsSolutions-CB4', reason: 'Uses S3 key for encryption' },
], true);