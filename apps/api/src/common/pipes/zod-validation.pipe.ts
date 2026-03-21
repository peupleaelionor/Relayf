import { PipeTransform, BadRequestException } from '@nestjs/common';

export class ZodValidationPipe implements PipeTransform {
  private schema: { safeParse: (v: unknown) => { success: boolean; data?: unknown; error?: { errors: Array<{ path: string[]; message: string }> } } };

  constructor(schema: any) {
    this.schema = schema;
  }

  transform(value: unknown) {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      const errors = (result.error?.errors || []).map((e: any) => `${e.path.join('.')}: ${e.message}`);
      throw new BadRequestException(errors);
    }
    return result.data;
  }
}
