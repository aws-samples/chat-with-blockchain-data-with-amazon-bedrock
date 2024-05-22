# Bedrock Blockchain Data Agent
This repository demonstrates how Amazon Bedrock Agents can be used to enable natural language queries of blockchain data. It uses the Bitcoin and Ethereum  data sets from [AWS Public Blockchain Data](https://registry.opendata.aws/aws-public-blockchain/).

To learn more, watch this overview and demo [Broadcast video](https://broadcast.amazon.com/videos/1144179).

Note, this CDK uses [experimental CDK constructs](npm install @cdklabs/generative-ai-cdk-constructs@0.1.150) to deploy the Bedrock agent.

### Installation
After cloning the repository, install the necessary dependencies:

```javascript
npm install
```

This assumes you are using `isengardcli`. Otherwise, you should first configure your local terminal environment `aws configure` and then run `cdk deploy BedrockBlockchainDataAgentStack`.

```code
isengardcli run --account myalias@amazon.com  --region us-east-1 -- cdk deploy BedrockBlockchainDataAgentStack
```

**Note:** If this is your first time deploying a CDK Application in your AWS Account, make sure to run `cdk bootstrap` before deploying the application with `cdk deploy BedrockBlockchainDataAgentStack`. 

It will take approximately two minutes for the CDK to be deployed. 

### Getting Started
1. Navigate to the Amazon Bedrock service in the AWS Console and choose [Agents](https://us-east-1.console.aws.amazon.com/bedrock/home?region=us-east-1#agents) under the Orchestration tab on the left sidebar.
2. Select the newly created Agent that starts with the name "bedrock-agent-*"
3. Enter a natural language question in the **Test** prompt window and hit `Run`

### Architecture
![Architecture](architecture.png)


### Clean up
To remove all created resources, run `cdk destroy`.

