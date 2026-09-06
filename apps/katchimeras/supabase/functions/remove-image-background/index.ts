import {createRemoveImageBackgroundHandler} from '../../../../../packages/art-service/src/remove-image-background.ts';
Deno.serve(createRemoveImageBackgroundHandler({bucketName:'katchimera-art-dev'}));
