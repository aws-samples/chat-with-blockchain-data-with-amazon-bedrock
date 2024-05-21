# Bedrock Blockchain Data Agent
After cloning the repository, run install the necessary dependencies with `npm install` 

This CDK uses [experimental CDK constructs](npm install @cdklabs/generative-ai-cdk-constructs@0.1.150) to deploy a Bedrock agent.

### Installation
This assumes you are using `isengardcli`. Otherwise, you should first configure your local terminal environment `aws configure` and then run `cdk deploy BedrockBlockchainDataAgentStack`.

```
isengardcli run --account myalias@amazon.com  --region us-east-1 -- cdk deploy BedrockBlockchainDataAgentStack
```

**Note:** If this is your first time deploying a CDK Application in your AWS Account, make sure to run `cdk bootstrap` before deploying the application with `cdk deploy`. 

It will take approximately 2 minutes for the CDK to be deployed. 

### Getting Started
1. Navigate to the Amazon Bedrock service in the AWS Console and choose [Agents](https://us-east-1.console.aws.amazon.com/bedrock/home?region=us-east-1#agents) under the Orchestration tab on the left sidebar.
2. Select the newly created Agent that starts with the name "bedrock-agent"
3. Enter a natural language question in the prompt window and select `Run`

### Clean up
To remove all created resources, run `cdk deploy`

