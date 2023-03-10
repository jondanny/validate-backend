data "aws_secretsmanager_secret_version" "current" {
  secret_id = var.secret_manager_id_api
}

data "aws_ecr_image" "valicit_backend_image" {
  repository_name = "valicit_backend"
  image_tag       = "api-production"
}

locals {
  env_vars = [
    for k, v in jsondecode(data.aws_secretsmanager_secret_version.current.secret_string) : { name = k, value = v }
  ]
}

resource "aws_ecs_cluster" "api_cluster" {
  name = "api_cluster"
}

data "aws_ami" "amz_linux" {
  owners      = ["amazon"]
  most_recent = true

  filter {
    name   = "name"
    values = ["amzn2-ami-ecs-hvm-2.0.*-x86_64-ebs"]
  }
}

resource "aws_cloudwatch_log_group" "api" {
  name = "api"

  tags = {
    Environment = "production"
    Application = "API"
  }
}

resource "aws_ecs_task_definition" "api_ecs_task_definition" {
  family                = "api_ecs_task_definition"
  network_mode          = "bridge"
  container_definitions = jsonencode([
    {
      command : ["npm", "run", "api:start:prod"],
      environment : local.env_vars,
      memory : 600
      essential : true,
      image : "${var.valicit_backend_erc_url}@${data.aws_ecr_image.valicit_backend_image.image_digest}",
      name : "api",
      portMappings : [
        {
          "containerPort" : 3000,
          "hostPort" : 0
        }
      ],
      logConfiguration: {
        logDriver: "awslogs",
        options: {
          awslogs-group: aws_cloudwatch_log_group.api.name,
          awslogs-region: "eu-west-1",
          awslogs-stream-prefix: "api"
        }
      }
    }
  ])
}

resource "aws_launch_configuration" "api_launch_config" {
  name_prefix                 = "ecs_api_"
  enable_monitoring           = true
  image_id                    = data.aws_ami.amz_linux.id
  iam_instance_profile        = var.ecs_agent_name
  security_groups             = [var.instance_security_group_id]
  associate_public_ip_address = true
  key_name                    = "validate-ec2-key"
  user_data                   = <<EOF
#!/bin/bash
echo ECS_CLUSTER=${aws_ecs_cluster.api_cluster.name} >> /etc/ecs/ecs.config
sudo dd if=/dev/zero of=/swapfile bs=128M count=8
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
sudo swapon -s
echo "/swapfile swap swap defaults 0 0" >> /etc/fstab
EOF
  instance_type               = "t3.small"

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_autoscaling_group" "api_ecs_asg" {
  name_prefix          = "api_asg"
  launch_configuration = aws_launch_configuration.api_launch_config.name
  target_group_arns = [aws_alb_target_group.api_tg.arn]
  vpc_zone_identifier = [var.public_subnet_a_id, var.public_subnet_b_id]
  
  desired_capacity          = 2
  min_size                  = 2
  max_size                  = 20
  min_elb_capacity          = 1
  health_check_type         = "EC2"

  lifecycle {
    create_before_destroy = true
  }

  tag {
    key                 = "Name"
    propagate_at_launch = true
    value               = "API"
  }
}

resource "aws_ecs_service" "api_service" {
  name            = "api_service"
  cluster         = aws_ecs_cluster.api_cluster.id
  task_definition = aws_ecs_task_definition.api_ecs_task_definition.arn
  desired_count   = 2
  deployment_minimum_healthy_percent = 50
  deployment_maximum_percent = 200
  force_new_deployment = true
  wait_for_steady_state = true

  deployment_circuit_breaker {
    enable = true
    rollback = true
  }

  load_balancer {
    target_group_arn = aws_alb_target_group.api_tg.arn
    container_name   = "api"
    container_port   = 3000
  }

  ordered_placement_strategy {
    type = "spread"
    field = "attribute:ecs.availability-zone"
  }

  ordered_placement_strategy {
    type = "spread"
    field = "instanceId"
  }

  timeouts {
    create = "10m"
    update = "10m"
    delete = "10m"
  }
}

resource "aws_alb" "api_alb" {
  name = "api-alb"
  internal = false
  load_balancer_type = "application"
  security_groups = [var.alb_security_group_id]
  subnets = [var.public_subnet_a_id, var.public_subnet_b_id]
  enable_http2 = true
}

resource "aws_alb_target_group" "api_tg" {
  name     = "api-tg"
  port     = 3000
  protocol = "HTTP"
  vpc_id   = var.vpc_id
  deregistration_delay = 30

  health_check {
    healthy_threshold   = 2
    unhealthy_threshold = 6
    timeout             = 3
    port                = "traffic-port"
    path                = "/api/v1/health-check"
    interval            = 30
  }
}

resource "aws_alb_listener" "http" {
  load_balancer_arn = aws_alb.api_alb.arn
  port              = "80"
  protocol          = "HTTP"

  default_action {
    type = "redirect"

    redirect {
      port        = "443"
      protocol    = "HTTPS"
      status_code = "HTTP_301"
    }
  }
}

resource "aws_alb_listener" "https" {
  load_balancer_arn = aws_alb.api_alb.arn
  port              = "443"
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-2016-08"
  certificate_arn   = "arn:aws:acm:eu-west-1:213564989596:certificate/5356869b-b09e-42fd-87cb-d047da4b63ad"

  default_action {
    type             = "forward"
    target_group_arn = aws_alb_target_group.api_tg.arn
  }
}