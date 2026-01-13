import requests

headers = {
    'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsImtpZCI6InJvY0lxTmVxek1oQ0tEUlNRdndxbENXcyIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJhIiwiZW52IjoicHJvZCIsImF1ZCI6ImZhc3RfY29uZmlnX3B1bGwiLCJpYXQiOjE3NjY1NDgwMDgsImV4cCI6MTc2OTE0MDAwOH0.s9IyKlWHeREm7bx2U3s3q0xuQS-UV6RxfDO96DC5RrA'
}
response = requests.get('http://localhost:9530/api/v1/pull/a/prod',headers=headers)

print(response.json())