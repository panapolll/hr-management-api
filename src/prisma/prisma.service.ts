import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient<Prisma.PrismaClientOptions, 'query'>
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    super({ log: [{ emit: 'event', level: 'query' }] });

    if (process.env.NODE_ENV === 'production') return;

    this.$on('query', (e) => {
      if (['SELECT 1', 'BEGIN', 'COMMIT'].includes(e.query)) return;

      const params = JSON.parse(e.params) as unknown[];

      const sql = e.query
        .replace(/"public"\./g, '')
        .replace(/"\w+"\.("\w+")/g, '$1')
        .replace(/"/g, '')
        .replace(/::text/g, '')
        .replace(/ AND 1=1| WHERE 1=1/g, '')
        .replace(/^SELECT (.+?) FROM/, (_m, cols: string) => {
          const n = cols.split(',').length;
          return n > 4 ? `SELECT (${n} คอลัมน์) FROM` : `SELECT ${cols} FROM`;
        })
        .replace(/\$(\d+)/g, (_m, i: string) => {
          const v = params[Number(i) - 1];
          return typeof v === 'string' ? `'${v}'` : String(v);
        })
        .replace(/ OFFSET 0/g, '');

      console.log(`🟦 ${sql}   ${e.duration}ms`);
    });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
