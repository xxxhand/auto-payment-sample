import { Controller, Get } from '@nestjs/common';
import { ProductApplicationService } from '../application/product.application.service';

@Controller('debug')
export class DebugController {
  constructor(private readonly productAppService: ProductApplicationService) {}

  @Get('test-products')
  async testProducts() {
    try {
      console.log('Calling ProductApplicationService...');
      const products = await this.productAppService.getProducts();
      console.log('Products fetched:', products.length);
      return {
        success: true,
        count: products.length,
        products: products.map((p) => ({
          id: p.id,
          name: p.name,
          status: p.status,
        })),
      };
    } catch (error) {
      console.error('Error in testProducts:', error);
      return {
        success: false,
        error: error.message,
        stack: error.stack,
      };
    }
  }
}
