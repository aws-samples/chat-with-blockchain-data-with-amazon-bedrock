#!/usr/bin/env python3
#  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
#  SPDX-License-Identifier: MIT-0
import boto3
import os
from time import sleep

# Initialize the Athena client
athena_client = boto3.client('athena')

def lambda_handler(event, context):
    print("Received event:", event)

    def athena_query_handler(event):
        try:
            # Fetch parameters for the new fields
            query = event['requestBody']['content']['application/json']['properties'][0]['value']
            print("Received QUERY:", query)
        except KeyError as e:
            print(f"Error extracting query: {e}")
            return {"error": "Invalid request structure"}

        bucket_name = os.environ['ATHENA_QUERY_RESULTS_BUCKET_NAME']
        s3_output = f"s3://{bucket_name}/"

        # Execute the query and wait for completion
        execution_id_response = execute_athena_query(query, s3_output)
        if 'error' in execution_id_response:
            return execution_id_response

        execution_id = execution_id_response['QueryExecutionId']
        result = get_query_results(execution_id)

        return result

    def execute_athena_query(query, s3_output):
        try:
            response = athena_client.start_query_execution(
                QueryString=query,
                ResultConfiguration={'OutputLocation': s3_output}
            )
            return {"QueryExecutionId": response['QueryExecutionId']}
        except Exception as e:
            error_message = str(e)
            print(f"Error starting query execution: {error_message}")
            return {"error": f"Failed to start query execution: {error_message}"}

    def check_query_status(execution_id):
        response = athena_client.get_query_execution(QueryExecutionId=execution_id)
        return response['QueryExecution']['Status']['State']

    def get_query_results(execution_id):
        while True:
            status = check_query_status(execution_id)
            if status in ['SUCCEEDED', 'FAILED', 'CANCELLED']:
                break
            sleep(1)  # Polling interval

        if status == 'SUCCEEDED':
            return athena_client.get_query_results(QueryExecutionId=execution_id)
        else:
            error_message = athena_client.get_query_execution(QueryExecutionId=execution_id)['QueryExecution']['Status']['StateChangeReason']
            print(f"Query failed with status '{status}': {error_message}")
            return {"error": f"Query failed with status '{status}': {error_message}"}

    action_group = event.get('actionGroup')
    api_path = event.get('apiPath')

    print("api_path:", api_path)

    result = ''
    response_code = 200

    if api_path == 'athenaQuery':
        result = athena_query_handler(event)
    else:
        response_code = 404
        result = {"error": f"Unrecognized api path: {action_group}::{api_path}"}

    response_body = {
        'application/json': {
            'body': result
        }
    }

    action_response = {
        'actionGroup': action_group,
        'apiPath': api_path,
        'httpMethod': event.get('httpMethod'),
        'httpStatusCode': response_code,
        'responseBody': response_body
    }

    api_response = {'messageVersion': '1.0', 'response': action_response}
    return api_response