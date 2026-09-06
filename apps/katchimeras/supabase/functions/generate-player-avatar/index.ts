import {createGeneratePlayerAvatarHandler} from '../../../../../packages/art-service/src/generate-player-avatar.ts';
Deno.serve(createGeneratePlayerAvatarHandler({renderBucketName: 'avatar-renders-public'}));
