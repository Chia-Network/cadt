resource "aws_s3_bucket" "storage-devops-bucket" {
  # Bucket name must be unique across all AWS users!
  bucket = "${var.default_storage_bucket}.dev"

  tags = {
    Name        = "${var.aws_profile} Configuration Bucket"
    Environment = "Dev"
  }
}

resource "aws_s3_bucket" "storage-bucket" {
  # Bucket name must be unique across all AWS users!
  bucket              = var.default_storage_bucket
  acceleration_status = "Enabled"
  policy              = jsonencode({
    "Version": "2012-10-17",
    "Statement": [
      {
        "Sid": "DistinctPublicFolder",
        "Effect": "Allow",
        "Principal": {
          "AWS": "*"
        },
        "Action": "s3:GetObject",
        "Resource": "arn:aws:s3:::${var.default_storage_bucket}/public/*"
      }
    ]
  })
  
  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["GET"]
    allowed_origins = ["*"]
    expose_headers  = ["ETag"]
    max_age_seconds = 3000
  }

  tags = {
    Name        = "${var.aws_profile} Storage Bucket"
    Environment = "Prod"
  }
}

resource "aws_s3_bucket_object" "public-folder" {
    bucket = aws_s3_bucket.storage-bucket.id
    acl    = "public-read"
    key    = "public/"
    source = "/dev/null"
}

output "bucket_id"     { value = aws_s3_bucket.storage-bucket.id }
output "dev_bucket_id" { value = aws_s3_bucket.storage-devops-bucket.id }