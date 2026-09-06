import {createGenerateAssetHandler} from '../../../../../packages/art-service/src/generate-asset.ts';
Deno.serve(createGenerateAssetHandler({bucketName:'katchimera-art-dev'}));
