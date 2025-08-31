import { Test, TestingModule } from '@nestjs/testing';
import { ConfService } from './conf.service';

describe('ConfService', () => {
  let service: ConfService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ConfService],
    }).compile();

    service = module.get<ConfService>(ConfService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
