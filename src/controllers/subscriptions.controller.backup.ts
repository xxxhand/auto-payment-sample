// Backup of original subscriptions controller with Phase 4.2 business service implementation
import { Controller, Post, Get, Put, Body, Param, Query, HttpStatus, HttpException } from '@nestjs/common';
import { CommonService, ErrException, errConstants } from '@myapp/common';
import { LoggerService } from '@nestjs/common';
import { CustomResult } from '@xxxhand/app-common';
import { SubscriptionService } from '../domain/services/subscription.service';
import { CustomerService } from '../domain/services/customer.service';
import {
  CreateSubscriptionRequest,
  CancelSubscriptionRequest,
  PlanChangeRequest,
  PauseSubscriptionRequest,
  RefundSubscriptionRequest,
} from '../domain/value-objects/subscription.request';

// This is the Phase 4.2 implementation that was causing test failures
// Moved to backup while we fix the issues
