import {createGenerateKatchimeraIdleHandler} from '../../../../../packages/art-service/src/generate-katchimera-idle.ts';
Deno.serve(createGenerateKatchimeraIdleHandler({bucketName:'katchimera-art-dev'}));
