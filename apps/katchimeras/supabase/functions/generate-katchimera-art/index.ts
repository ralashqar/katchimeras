import {createGenerateKatchimeraArtHandler} from '../../../../../packages/art-service/src/generate-katchimera-art.ts';
Deno.serve(createGenerateKatchimeraArtHandler({bucketName:'katchimera-art-dev'}));
