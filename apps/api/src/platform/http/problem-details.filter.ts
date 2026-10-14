import { ArgumentsHost, Catch, type ExceptionFilter } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { toProblem } from './problem-details.js';

/** Convierte cualquier excepción en `application/problem+json`. Registrado en el composition root. */
@Catch()
export class ProblemDetailsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const res = http.getResponse<{ status(n: number): { type(t: string): { send(b: unknown): void } } }>();
    const req = http.getRequest<{ headers: Record<string, string | string[] | undefined> }>();
    const header = req.headers['x-request-id'];
    const requestId = (Array.isArray(header) ? header[0] : header) ?? randomUUID();
    const problem = toProblem(exception, requestId);
    res.status(problem.status).type('application/problem+json').send(problem);
  }
}
