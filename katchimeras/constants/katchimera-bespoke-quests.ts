import type { KatchimeraFamilyId } from '@/types/katchimera';

export type BespokeQuestCopy = {
  suffix: string;
  minimumBondLevel: 1 | 2 | 3;
  title: string;
  hint: string;
  matchCriteria: readonly string[];
  exclusions?: readonly string[];
  photoQualityId?: string;
  photoLabel?: string;
};

export type BespokeFamilyQuestPack = {
  familyId: KatchimeraFamilyId;
  role: string;
  boundary: string;
  hatchSignals: readonly string[];
  journalRoutes: readonly string[];
  insightThemes: readonly string[];
  reflectionLenses: readonly string[];
  goalTypes: readonly string[];
  quests: readonly [BespokeQuestCopy, BespokeQuestCopy, BespokeQuestCopy, BespokeQuestCopy];
};

const q = (
  suffix: string,
  minimumBondLevel: 1 | 2 | 3,
  title: string,
  hint: string,
  matchCriteria: readonly string[],
  exclusions?: readonly string[]
): BespokeQuestCopy => ({ suffix, minimumBondLevel, title, hint, matchCriteria, exclusions });

const p = (
  suffix: string,
  title: string,
  hint: string,
  photoQualityId: string,
  photoLabel: string
): BespokeQuestCopy => ({
  suffix,
  minimumBondLevel: 1,
  title,
  hint,
  matchCriteria: [photoLabel],
  photoQualityId,
  photoLabel,
});

/**
 * Family-owned content for every art-complete family that previously fell
 * through to broad aspect quests. Each pack deliberately owns a narrower
 * behaviour than its aspect and supplies a four-step real-life ladder.
 */
export const BESPOKE_FAMILY_QUEST_PACKS: readonly BespokeFamilyQuestPack[] = [
  {
    familyId: 'crumbun',
    role: 'Turns baking and bakery discoveries into warm, repeatable rituals.',
    boundary: 'Bread, pastry, and baking craft—not meals generally or drink rituals.',
    hatchSignals: ['bakery visit', 'bread or pastry', 'home baking'],
    journalRoutes: ['journal.route:food.cooking', 'journal.route:food.meal'],
    insightThemes: ['baking rituals', 'bakery discoveries', 'things made by hand'],
    reflectionLenses: ['the craft behind a bake', 'comfort and sharing', 'what to make next'],
    goalTypes: ['bake something', 'visit a bakery', 'learn a baking skill'],
    quests: [
      q('bakery-find', 1, 'Find one good bake', 'Share a bread, pastry, or bakery find and what made it worth choosing.', ['A real bread, pastry, or bakery item is named', 'One specific taste, texture, craft, or reason for choosing it is included']),
      q('baking-detail', 1, 'Keep one baking detail', 'Record something you baked and one step, ingredient, texture, or technique that mattered.', ['A real baking attempt is described', 'A concrete ingredient, step, texture, or technique is included']),
      q('share-a-bake', 2, 'Pass something warm along', 'Share or choose a bake for someone and record what made the gesture feel thoughtful.', ['A bread or baked item was shared or chosen for someone', 'The person or meaning of the gesture is clear']),
      q('weekly-review', 3, 'Read the week in crumbs', 'Review one bake or bakery moment, what you learned, and what you want to try next.', ['A real example from the week is named', 'A learning or preference is identified', 'One next baking or bakery intention is stated']),
    ],
  },
  {
    familyId: 'hayhorn',
    role: 'Reconnects food with ingredients, growers, markets, and where meals begin.',
    boundary: 'Food origins and seasonal ingredients—not generic cooking or countryside travel.',
    hatchSignals: ['farm or market visit', 'seasonal produce', 'ingredient origin'],
    journalRoutes: ['journal.route:food.cooking', 'journal.route:food.meal'],
    insightThemes: ['ingredient origins', 'seasonal food', 'markets and growers'],
    reflectionLenses: ['where food came from', 'seasonal change', 'care behind ingredients'],
    goalTypes: ['buy seasonal produce', 'visit a market', 'cook from one ingredient'],
    quests: [
      q('ingredient-origin', 1, 'Trace one ingredient', 'Choose something you ate or cooked and record where it came from or how it was grown.', ['A real ingredient or food is named', 'Its source, season, producer, or growing context is described']),
      q('seasonal-find', 1, 'Spot what is in season', 'Keep one seasonal ingredient you noticed at a shop, market, farm, or meal.', ['A specific seasonal ingredient is named', 'Where it was noticed or used is included']),
      q('cook-close-to-source', 2, 'Cook closer to the source', 'Make something around one fresh or locally meaningful ingredient and record the result.', ['A real dish or preparation is described', 'A particular fresh, local, or seasonal ingredient is central']),
      q('weekly-review', 3, 'Read the ingredient trail', 'Review what connected you to food origins this week and choose one thread to continue.', ['A real ingredient or market example is included', 'A pattern or learning is identified', 'One next sourcing or cooking choice is stated']),
    ],
  },
  {
    familyId: 'crustling',
    role: 'Makes pizza nights a small practice of choosing, making, and sharing well.',
    boundary: 'Pizza as a social or cooking ritual—not Italian food or meals generally.',
    hatchSignals: ['pizza meal', 'pizza place', 'homemade pizza'],
    journalRoutes: ['journal.route:food.meal', 'journal.route:food.cooking'],
    insightThemes: ['pizza places', 'homemade combinations', 'shared pizza nights'],
    reflectionLenses: ['the combination that worked', 'who shared it', 'what made the place distinct'],
    goalTypes: ['try a pizza place', 'make a pizza', 'share a pizza night'],
    quests: [
      q('slice-detail', 1, 'Keep one perfect slice', 'Record a pizza you actually ate and one crust, topping, sauce, or place detail.', ['A real pizza meal is described', 'A specific crust, topping, sauce, preparation, or venue detail is included']),
      q('new-combination', 1, 'Try a different combination', 'Choose a pizza topping or style outside your usual order and say how it landed.', ['A new-to-the-player pizza style or topping is named', 'A concrete reaction or comparison is included']),
      q('make-or-share', 2, 'Make pizza an occasion', 'Make or share a pizza with intention and record what made the time work.', ['A pizza was made or deliberately shared', 'A preparation or connection detail is included']),
      q('weekly-review', 3, 'Read the pizza trail', 'Review one pizza moment, what your taste is teaching you, and the next thing to try.', ['A real pizza example is named', 'A preference or pattern is identified', 'One next place, style, or making idea is stated']),
    ],
  },
  {
    familyId: 'nigirimp',
    role: 'Encourages attentive Japanese food discovery through precision, balance, and craft.',
    boundary: 'Japanese dishes and their craft—not all restaurant meals or Asian food generally.',
    hatchSignals: ['sushi or Japanese meal', 'Japanese restaurant', 'carefully presented dish'],
    journalRoutes: ['journal.route:food.meal'],
    insightThemes: ['Japanese dishes', 'balance and presentation', 'new tastes'],
    reflectionLenses: ['craft in the dish', 'a subtle flavour', 'what to explore next'],
    goalTypes: ['try a Japanese dish', 'learn a food detail', 'return to a favourite place'],
    quests: [
      q('dish-detail', 1, 'Notice the quiet craft', 'Record a Japanese dish and one ingredient, preparation, presentation, or balance detail.', ['A real Japanese dish is named', 'A specific ingredient, technique, presentation, texture, or balance detail is included']),
      q('try-something-new', 1, 'Choose beyond the usual', 'Try a Japanese dish or ingredient that is new to you and keep an honest reaction.', ['A new-to-the-player Japanese dish or ingredient is named', 'A concrete reaction is included']),
      q('learn-the-context', 2, 'Learn what sits behind the dish', 'Keep one thing you learned about the dish, region, ingredient, or way it is served.', ['A specific Japanese food is identified', 'A factual or personal context detail is included']),
      q('weekly-review', 3, 'Read the tasting path', 'Review one Japanese food moment, what your palate noticed, and what to explore next.', ['A real meal example is named', 'A taste or craft pattern is identified', 'One next dish, place, or question is stated']),
    ],
  },
  {
    familyId: 'noodloo',
    role: 'Turns noodle meals into a trail of broths, textures, regions, and comforting returns.',
    boundary: 'Noodle dishes and their variations—not meals generally or one national cuisine.',
    hatchSignals: ['ramen or noodle meal', 'noodle restaurant', 'homemade noodles'],
    journalRoutes: ['journal.route:food.meal', 'journal.route:food.cooking'],
    insightThemes: ['noodle styles', 'broths and textures', 'comforting returns'],
    reflectionLenses: ['what made the bowl distinct', 'comfort and energy', 'the next variation'],
    goalTypes: ['try a noodle style', 'make a noodle dish', 'find a favourite bowl'],
    quests: [
      q('bowl-detail', 1, 'Read the bowl', 'Record a noodle dish and one broth, sauce, noodle, topping, or texture detail.', ['A real noodle dish is named', 'A specific broth, sauce, noodle, topping, preparation, or texture detail is included']),
      q('new-noodle', 1, 'Take a different noodle path', 'Try a noodle style or preparation that differs from your usual and compare it.', ['A different or new noodle style is named', 'A concrete comparison or reaction is included']),
      q('build-a-bowl', 2, 'Build your own bowl', 'Cook or customise a noodle bowl deliberately and keep what you would repeat.', ['A noodle dish was cooked or deliberately customised', 'A specific choice and its result are described']),
      q('weekly-review', 3, 'Read the week in bowls', 'Review one noodle moment, the pattern in what you enjoyed, and your next bowl.', ['A real noodle meal is named', 'A taste or comfort pattern is identified', 'One next style, place, or recipe is stated']),
    ],
  },
  {
    familyId: 'sundael',
    role: 'Makes desserts an intentional pleasure built around taste, occasion, and sharing.',
    boundary: 'Dessert and sweet treats—not everyday meals or celebration milestones broadly.',
    hatchSignals: ['dessert', 'ice cream', 'sweet shop or bakery treat'],
    journalRoutes: ['journal.route:food.dessert'],
    insightThemes: ['dessert discoveries', 'treat occasions', 'flavours shared'],
    reflectionLenses: ['why the treat felt worth it', 'taste and texture', 'who shared it'],
    goalTypes: ['try a dessert', 'make a sweet thing', 'share a treat'],
    quests: [
      q('dessert-detail', 1, 'Keep the best spoonful', 'Record a dessert and one flavour, texture, temperature, or presentation detail.', ['A real dessert is named', 'A specific flavour, texture, temperature, or presentation detail is included']),
      q('new-sweet', 1, 'Try a new sweet note', 'Choose a dessert or flavour that is new to you and keep the honest verdict.', ['A new-to-the-player dessert or flavour is named', 'A concrete reaction is included']),
      q('make-it-an-occasion', 2, 'Make the treat an occasion', 'Make or share a dessert deliberately and record what made the moment special.', ['A dessert was made or deliberately shared', 'The occasion, person, or meaningful choice is described']),
      q('weekly-review', 3, 'Read the sweet week', 'Review one dessert moment, what you actually value in a treat, and what comes next.', ['A real dessert example is named', 'A preference or occasion pattern is identified', 'One next dessert, place, or making idea is stated']),
    ],
  },
  {
    familyId: 'bobaloo',
    role: 'Celebrates playful cold drinks, flavour combinations, and easy social pauses.',
    boundary: 'Bubble tea and playful drinks—not caffeine routines or food generally.',
    hatchSignals: ['bubble tea', 'colourful cold drink', 'shared drink stop'],
    journalRoutes: ['journal.route:food.drink', 'journal.route:food.tea'],
    insightThemes: ['drink combinations', 'shared stops', 'small playful treats'],
    reflectionLenses: ['the combination that worked', 'the pause around the drink', 'who shared it'],
    goalTypes: ['try a drink combination', 'share a drink stop', 'find a favourite order'],
    quests: [
      q('order-detail', 1, 'Build the drink', 'Record a bubble tea or playful drink and the base, flavour, topping, sweetness, or texture choices.', ['A real bubble tea or comparable mixed drink is named', 'At least one specific flavour, base, topping, sweetness, ice, or texture choice is included']),
      q('new-combination', 1, 'Shake up the usual order', 'Try one change to your usual drink and say whether it earned a return.', ['A new drink or deliberate order change is described', 'A concrete reaction or comparison is included']),
      q('share-the-stop', 2, 'Turn the drink into a pause', 'Share a drink stop with someone or take a deliberate solo pause and record the setting.', ['A deliberate drink pause occurred', 'The company, setting, or effect of the pause is described']),
      q('weekly-review', 3, 'Read the flavour trail', 'Review one drink moment, what your choices reveal, and the next combination to try.', ['A real drink example is named', 'A preference or ritual pattern is identified', 'One next order or pause is stated']),
    ],
  },
  {
    familyId: 'voltstep',
    role: 'Channels high-energy cardio into short, deliberate bursts with enough recovery.',
    boundary: 'Intervals and vigorous cardio—not steady running, walking, or strength training.',
    hatchSignals: ['vigorous cardio', 'interval session', 'high-intensity movement'],
    journalRoutes: ['journal.route:movement.workout'],
    insightThemes: ['cardio intensity', 'effort and recovery', 'short energetic sessions'],
    reflectionLenses: ['where effort peaked', 'how recovery felt', 'what made intensity sustainable'],
    goalTypes: ['cardio rhythm', 'interval confidence', 'recovery between efforts'],
    quests: [
      q('energy-burst', 1, 'Use one clean burst', 'Complete a short vigorous cardio effort and record what you did and how long it lasted.', ['A completed vigorous cardio effort is described', 'The activity and a duration, interval, round, or intensity detail are included'], ['A gentle walk with no vigorous interval']),
      q('effort-detail', 1, 'Find the hard minute', 'Keep one moment where the effort changed and what your body told you.', ['A real cardio session is described', 'A concrete effort, breathing, heart-rate, pace, or body-response detail is included']),
      q('recover-on-purpose', 2, 'Recover between sparks', 'Pair a hard effort with a deliberate recovery choice and record the difference.', ['A vigorous effort and a recovery action are both described', 'The effect of the recovery choice is included']),
      q('weekly-review', 3, 'Read the energy curve', 'Review one intense session, what made it sustainable, and how you will pace the next one.', ['A real cardio example is named', 'An effort or recovery pattern is identified', 'One next pacing or recovery choice is stated']),
    ],
  },
  {
    familyId: 'pulsepounce',
    role: 'Builds joyful agility, quick-feet practice, and movement that feels playful.',
    boundary: 'Agility and playful dynamic movement—not running mileage, gym strength, or court-specific sport.',
    hatchSignals: ['agility practice', 'dance or quick-feet movement', 'playful cardio'],
    journalRoutes: ['journal.route:movement.mixed', 'journal.route:movement.workout'],
    insightThemes: ['agility', 'playful movement', 'coordination and confidence'],
    reflectionLenses: ['the move that clicked', 'where play replaced pressure', 'what coordination needs next'],
    goalTypes: ['agility rhythm', 'coordination practice', 'playful cardio'],
    quests: [
      q('quick-feet', 1, 'Wake up your quick feet', 'Complete a short agility, dance, skipping, or quick-feet practice and record the pattern.', ['A completed dynamic movement practice is described', 'A specific drill, step, sequence, or movement pattern is included']),
      q('coordination-detail', 1, 'Catch one move cleanly', 'Keep one movement that became smoother, sharper, or more confident.', ['A real movement attempt is described', 'A concrete coordination change or successful move is included']),
      q('make-it-play', 2, 'Make the session playful', 'Change one movement session so it feels more like play and record what helped.', ['A real movement session is described', 'A deliberate playful choice and its effect are included']),
      q('weekly-review', 3, 'Read the movement pattern', 'Review one agility moment, what is clicking, and the next pattern to practise.', ['A real example from the week is named', 'A coordination or enjoyment pattern is identified', 'One next practice focus is stated']),
    ],
  },
  {
    familyId: 'museling',
    role: 'Protects hands-on creative practice and the small ideas that become real things.',
    boundary: 'Making original work—not consuming media, gaming, or visiting cultural venues.',
    hatchSignals: ['creative project', 'drawing or making', 'new idea developed'],
    journalRoutes: ['journal.route:work.creative'],
    insightThemes: ['creative practice', 'ideas developed', 'materials and process'],
    reflectionLenses: ['where the idea came alive', 'process over outcome', 'what wants another session'],
    goalTypes: ['creative session', 'finish a piece', 'try a material'],
    quests: [
      q('make-something', 1, 'Make one thing exist', 'Spend time on an original creative piece and record what you made or changed.', ['A real creative session is described', 'The piece, medium, or concrete change is named']),
      q('process-detail', 1, 'Keep one process detail', 'Record a material, tool, technique, or decision that shaped today’s making.', ['A real creative process is described', 'A specific material, tool, technique, or decision is included']),
      q('creative-risk', 2, 'Try the idea that might not work', 'Take one small creative risk and keep what happened instead of judging the result.', ['A specific creative experiment or risk was attempted', 'Its outcome or learning is described']),
      q('weekly-review', 3, 'Read the making week', 'Review one creative session, the thread that is emerging, and the next thing to make.', ['A real creative example is named', 'A theme, process, or friction pattern is identified', 'One next creative action is stated']),
    ],
  },
  {
    familyId: 'pixooka',
    role: 'Makes gaming intentional by noticing play, mastery, stories, and when a session feels complete.',
    boundary: 'Playing video games—not watching media, tabletop hobbies, or passive screen time.',
    hatchSignals: ['video game session', 'game progress', 'cooperative play'],
    journalRoutes: ['journal.route:studio.game'],
    insightThemes: ['games played', 'challenge and mastery', 'social versus solo play'],
    reflectionLenses: ['the moment the game created', 'what was learned', 'when play felt satisfying'],
    goalTypes: ['finish a game chapter', 'practise a skill', 'play socially'],
    quests: [
      q('session-moment', 1, 'Keep one game moment', 'Record a game you played and one specific decision, discovery, challenge, or story beat.', ['A real video-game session and title are clear', 'A specific decision, discovery, challenge, mechanic, or story beat is included']),
      q('learn-the-system', 1, 'Learn one piece of the game', 'Keep one mechanic, route, strategy, or skill that became clearer today.', ['A real game is identified', 'A specific mechanic, strategy, route, or skill learning is described']),
      q('end-on-purpose', 2, 'Choose the end of the session', 'Finish a gaming session deliberately and record what made that stopping point feel right.', ['A real gaming session occurred', 'A deliberate stopping point and reason are described']),
      q('weekly-review', 3, 'Read the play week', 'Review one game moment, what kind of play served you, and what you want from the next session.', ['A real game example is named', 'A play, mood, challenge, or time-use pattern is identified', 'One next play intention is stated']),
    ],
  },
  {
    familyId: 'glimmuse',
    role: 'Builds a personal relationship with visual art through looking, context, and response.',
    boundary: 'Visual art and exhibitions—not history broadly, making art, or film and books.',
    hatchSignals: ['gallery or exhibition', 'artwork', 'visual-art reflection'],
    journalRoutes: ['journal.route:studio.art', 'journal.route:went_somewhere.museum'],
    insightThemes: ['artworks encountered', 'visual preferences', 'artists and exhibitions'],
    reflectionLenses: ['what held the gaze', 'context that changed the work', 'a visual idea worth keeping'],
    goalTypes: ['visit an exhibition', 'look closely at art', 'learn about an artist'],
    quests: [
      q('artwork-detail', 1, 'Stay with one artwork', 'Choose an artwork you really saw and record one visual detail that held your attention.', ['A real artwork or exhibition encounter is described', 'A specific colour, form, material, subject, scale, or composition detail is included']),
      q('response-note', 1, 'Name your response', 'Keep what an artwork made you feel, question, remember, or see differently.', ['A specific artwork or visual-art encounter is identified', 'A personal response, question, memory, or changed perspective is included']),
      q('add-context', 2, 'Look behind the frame', 'Learn one thing about an artist, work, or exhibition and record how it changed your view.', ['A factual context detail about an artwork, artist, or exhibition is included', 'Its effect on the player’s interpretation is described']),
      q('weekly-review', 3, 'Read the gallery trail', 'Review one artwork, the visual pattern drawing you in, and what you want to see next.', ['A real artwork example is named', 'A visual preference or question is identified', 'One next artist, work, or exhibition intention is stated']),
    ],
  },
  {
    familyId: 'shellio',
    role: 'Builds a safe, personal relationship with swimming, beaches, shores, and time near water.',
    boundary: 'Swimming and water-place connection—not competitive performance, unsafe water entry, weather collecting, or generic outdoor time.',
    hatchSignals: ['swimming or pool', 'beach or coast', 'river, lake, or water-side pause'],
    journalRoutes: ['journal.route:went_somewhere.beach'],
    insightThemes: ['swimming experiences', 'water confidence and fit', 'beaches and water places'],
    reflectionLenses: ['how the swim or shore time felt', 'what supported safety and confidence', 'a water experience worth returning to'],
    goalTypes: ['build a swimming rhythm', 'grow water confidence', 'spend time at a beach or shore', 'connect with water without entering'],
    quests: [
      p('water-detail', 'Keep one real water moment', 'Capture a pool, beach, shore, or real body of water connected to your experience.', 'nature.water', 'Photograph a real swimming or water place'),
      q('shore-pause', 1, 'Choose your water moment', 'Swim in a suitable setting, spend time at a beach or shore, or connect with water without entering; record what you chose and how it felt.', ['A real swim, beach, shore, or non-entry water moment is described', 'The choice and its effect on comfort, confidence, energy, mood, or attention are included']),
      q('return-to-water', 2, 'Make a safe return to water', 'Return to a suitable swim or water place and notice what made it fit—or told you to adapt, stay out, or stop.', ['A real return to swimming or a water place is described', 'A specific safety, access, confidence, body, environmental, or sensory condition is included']),
      q('weekly-review', 3, 'Read your water week', 'Review one swim or water-place moment, what supported it, and the next water experience that would genuinely suit you.', ['A real swimming, beach, shore, or water-place example is named', 'A support, barrier, preference, or safety pattern is identified', 'One suitable next swim, shore visit, non-entry connection, adaptation, or pause is stated']),
    ],
  },
  {
    familyId: 'petalimp',
    role: 'Supports hands-on gardening through small acts of tending and noticing growth.',
    boundary: 'Caring for plants and gardens—not simply visiting green spaces or admiring flowers.',
    hatchSignals: ['gardening', 'plant care', 'something grown'],
    journalRoutes: ['journal.route:went_somewhere.garden', 'journal.route:general.ordinary'],
    insightThemes: ['plant care', 'growth and setbacks', 'seasonal tending'],
    reflectionLenses: ['what the plant needed', 'small signs of growth', 'what to tend next'],
    goalTypes: ['care for a plant', 'grow something', 'build a garden rhythm'],
    quests: [
      p('garden-moment', 'Keep the garden you tended', 'Capture the real garden or growing space where you cared for something.', 'place.garden', 'Photograph a real garden'),
      q('growth-detail', 1, 'Spot one sign of growth', 'Keep one new leaf, bud, root, change, pest, or soil detail you actually noticed.', ['A real plant or garden is identified', 'A specific growth, health, soil, pest, or seasonal detail is included']),
      q('solve-a-plant-need', 2, 'Respond to the garden', 'Notice one plant problem or need, take a useful action, and record the result.', ['A specific plant need or problem is identified', 'A completed response and its result are described']),
      q('weekly-review', 3, 'Read the growing week', 'Review one thing you tended, what changed, and the next care action.', ['A real plant-care example is named', 'A growth or care pattern is identified', 'One next tending action is stated']),
    ],
  },
  {
    familyId: 'fernip',
    role: 'Encourages curious, grounded time on woodland paths and beneath tree cover.',
    boundary: 'Forests, woods, and trails—not parks, summits, or gardening.',
    hatchSignals: ['forest visit', 'woodland trail', 'tree-covered walk'],
    journalRoutes: ['journal.route:went_somewhere.forest'],
    insightThemes: ['woodland visits', 'trail details', 'places returned to'],
    reflectionLenses: ['what the path revealed', 'life beneath the canopy', 'how the woods changed attention'],
    goalTypes: ['walk in woods', 'return to a trail', 'notice woodland life'],
    quests: [
      p('forest-detail', 'Keep one forest detail', 'Capture the real woodland or tree-covered trail you explored.', 'place.forest', 'Photograph a real forest or woodland trail'),
      q('follow-a-path', 1, 'Follow the path a little farther', 'Take a woodland route and keep one turning point, landmark, or discovery.', ['A completed woodland walk or trail is described', 'A specific route, landmark, turning point, or discovery is included']),
      q('return-under-cover', 2, 'Return beneath the canopy', 'Revisit a wooded place and record what the season or your attention changed.', ['A woodland place was revisited', 'A specific seasonal, environmental, or attention difference is included']),
      q('weekly-review', 3, 'Read the woodland trail', 'Review one forest moment, what keeps drawing you back, and the next path to take.', ['A real woodland example is named', 'A place, sensory, or route pattern is identified', 'One next woodland intention is stated']),
    ],
  },
  {
    familyId: 'amberleaf',
    role: 'Helps the player notice autumn as a season of colour, turning, and preparation.',
    boundary: 'Autumn change and rituals—not weather generally or gardening work.',
    hatchSignals: ['autumn colour', 'falling leaves', 'seasonal transition'],
    journalRoutes: ['journal.route:went_somewhere.park', 'journal.route:general.ordinary'],
    insightThemes: ['autumn change', 'seasonal rituals', 'places turning colour'],
    reflectionLenses: ['what is changing', 'what is being released', 'how to prepare gently'],
    goalTypes: ['notice autumn change', 'keep a seasonal ritual', 'visit autumn colour'],
    quests: [
      p('turning-detail', 'Find the first turning leaf', 'Capture a real sign of autumn colour or falling leaves.', 'nature.autumn', 'Photograph a real sign of autumn'),
      q('seasonal-ritual', 1, 'Keep one autumn ritual', 'Do one small thing that belongs to this season and record why it felt right now.', ['A completed autumn-specific action or ritual is described', 'Its seasonal meaning or effect is included']),
      q('prepare-for-change', 2, 'Prepare for the turn', 'Make one practical or comforting adjustment for the colder, darker season.', ['A concrete seasonal preparation was completed', 'The need or benefit of the adjustment is described']),
      q('weekly-review', 3, 'Read the turning week', 'Review one autumn change, how it affected you, and what you want to carry forward.', ['A real seasonal example is named', 'A change in place, routine, or feeling is identified', 'One next seasonal intention is stated']),
    ],
  },
  {
    familyId: 'blossle',
    role: 'Marks spring through blossom, return, and the first visible signs of renewal.',
    boundary: 'Spring blossom and seasonal emergence—not gardening care or flowers generally.',
    hatchSignals: ['spring blossom', 'flowering trees', 'first spring signs'],
    journalRoutes: ['journal.route:went_somewhere.garden', 'journal.route:went_somewhere.park'],
    insightThemes: ['spring emergence', 'blossom places', 'annual returns'],
    reflectionLenses: ['what returned', 'the briefness of blossom', 'where renewal appeared'],
    goalTypes: ['find blossom', 'return to a spring place', 'notice seasonal renewal'],
    quests: [
      p('first-blossom', 'Find the first blossom', 'Capture real blossom or a flowering tree where you found it.', 'nature.blossom', 'Photograph real spring blossom'),
      q('spring-return', 1, 'Notice what came back', 'Keep one plant, sound, light, or routine that has returned with spring.', ['A specific sign of spring returning is named', 'The real place or moment is included']),
      q('revisit-in-bloom', 2, 'Return while it is blooming', 'Revisit a spring place and record what changed since the last time.', ['A place was revisited during spring or blossom season', 'A specific environmental or personal difference is included']),
      q('weekly-review', 3, 'Read the spring opening', 'Review one sign of renewal, what it stirred in you, and what to notice next.', ['A real spring example is named', 'A seasonal or emotional pattern is identified', 'One next spring-noticing intention is stated']),
    ],
  },
  {
    familyId: 'peakle',
    role: 'Builds confidence for hills, hikes, and reaching real viewpoints under your own power.',
    boundary: 'Hiking, ascent, and summits—not ordinary walking, running, or travel sightseeing.',
    hatchSignals: ['hike', 'hill or summit', 'elevation and viewpoint'],
    journalRoutes: ['journal.route:movement.hike'],
    insightThemes: ['hiking confidence', 'climbs and viewpoints', 'effort on trails'],
    reflectionLenses: ['where the climb changed', 'what the view meant', 'how the body handled ascent'],
    goalTypes: ['take a hike', 'build climbing confidence', 'reach a viewpoint'],
    quests: [
      p('summit-view', 'Keep the height you reached', 'Capture the real hill, mountain, or summit view reached on your outing.', 'nature.mountains', 'Photograph a real hill, mountain, or summit view'),
      q('viewpoint', 1, 'Reach a viewpoint', 'Walk to a place with a wider view and record what became visible.', ['A real viewpoint was reached under the player’s own movement', 'A specific view or sense of arrival is described']),
      q('pace-the-ascent', 2, 'Find your climbing pace', 'Make one deliberate pacing, kit, route, or rest choice on a climb and keep the result.', ['A real climb or hike is described', 'A deliberate pacing, equipment, route, or recovery choice and its effect are included']),
      q('weekly-review', 3, 'Read the ridge line', 'Review one climb, what built confidence, and the next realistic hill or trail.', ['A real hiking example is named', 'An effort, confidence, route, or preparation pattern is identified', 'One next hiking intention is stated']),
    ],
  },
  {
    familyId: 'stillo',
    role: 'Creates restorative stillness beside calm water and reflective places.',
    boundary: 'Still water and contemplative pauses—not coasts, active water sport, or meditation generally.',
    hatchSignals: ['still lake or pond', 'water reflection', 'quiet waterside pause'],
    journalRoutes: ['journal.route:went_somewhere.park', 'journal.route:went_somewhere.beach'],
    insightThemes: ['still-water places', 'reflection and quiet', 'slow returns'],
    reflectionLenses: ['what became clear', 'the surface and what lay beneath', 'how stillness changed attention'],
    goalTypes: ['visit still water', 'take a quiet pause', 'return to a reflective place'],
    quests: [
      q('surface-detail', 1, 'Read the surface', 'Visit still or slow water and record one reflection, ripple, sound, light, or wildlife detail.', ['A real pond, lake, reservoir, canal, or slow-water place is described', 'A specific surface, reflection, sound, light, or wildlife detail is included']),
      q('quiet-pause', 1, 'Stay until it settles', 'Take a quiet pause beside water and record what settled or became clearer.', ['A deliberate quiet pause beside water occurred', 'A concrete change in attention, tension, mood, or thought is included']),
      q('return-to-stillness', 2, 'Return to the same surface', 'Revisit a calm-water place and notice what changed in the water or in you.', ['A still-water place was revisited', 'A specific environmental or personal difference is included']),
      q('weekly-review', 3, 'Read the quiet water', 'Review one still-water moment, what it gave you, and where to make room for quiet next.', ['A real water-side example is named', 'A quiet, place, or attention pattern is identified', 'One next stillness intention is stated']),
    ],
  },
  {
    familyId: 'drizzlet',
    role: 'Helps rainy days become noticed experiences rather than blank interruptions.',
    boundary: 'Rain and how life changes around it—not storms, fog, snow, or weather broadly.',
    hatchSignals: ['rainy day', 'rain walk', 'sound or pattern of rain'],
    journalRoutes: ['journal.route:general.ordinary'],
    insightThemes: ['rainy-day rhythms', 'rain sounds and streets', 'plans adapted'],
    reflectionLenses: ['what rain changed', 'shelter and comfort', 'the world under rain'],
    goalTypes: ['notice rain', 'take a rain walk', 'make a rainy-day ritual'],
    quests: [
      q('rain-detail', 1, 'Catch one rain detail', 'Record real rain and one sound, surface, light, smell, or movement detail.', ['Rain experienced today is explicit', 'A specific sensory or environmental rain detail is included']),
      q('rain-choice', 1, 'Choose how to meet the rain', 'Do one deliberate thing because it was raining and record how it changed the day.', ['A completed action adapted to or used the rain', 'Its effect on the day is described']),
      q('go-out-anyway', 2, 'Step into the wet world', 'Take a safe short trip or walk in rain and keep one thing you would have missed indoors.', ['A real safe outing in rain is described', 'A specific observation or experience from going out is included']),
      q('weekly-review', 3, 'Read the rainy week', 'Review one rainy moment, how your routines respond, and what you want to keep.', ['A real rainy-day example is named', 'A routine, comfort, or mood pattern is identified', 'One next rainy-day choice is stated']),
    ],
  },
  {
    familyId: 'driftkin',
    role: 'Marks snow days through quiet observation, changed routes, and winter wonder.',
    boundary: 'Snow and frost—not cold weather generally or mountain sport.',
    hatchSignals: ['snowfall', 'snow-covered place', 'frost or winter hush'],
    journalRoutes: ['journal.route:general.ordinary'],
    insightThemes: ['snow days', 'winter quiet', 'places transformed'],
    reflectionLenses: ['what snow changed', 'the first trace', 'warmth against winter'],
    goalTypes: ['notice snowfall', 'take a winter walk', 'keep a snow-day ritual'],
    quests: [
      p('snow-detail', 'Keep one snow trace', 'Capture real snow covering or changing the place around you.', 'nature.snow', 'Photograph real snow'),
      q('changed-place', 1, 'See a familiar place changed', 'Visit or look closely at a familiar place under snow or frost and record the difference.', ['A familiar real place under snow or frost is identified', 'A specific transformation is described']),
      q('winter-choice', 2, 'Make the cold day workable', 'Make one deliberate warmth, safety, route, or activity choice for snow and keep its effect.', ['A concrete snow-day or frost-day adjustment was completed', 'Its practical or emotional effect is included']),
      q('weekly-review', 3, 'Read the snow hush', 'Review one winter moment, what the changed conditions revealed, and what to carry onward.', ['A real snow or frost example is named', 'A place, routine, or feeling pattern is identified', 'One next winter intention is stated']),
    ],
  },
  {
    familyId: 'duskle',
    role: 'Makes golden hour a deliberate threshold for noticing light and closing the day.',
    boundary: 'Sunset, dusk, and golden light—not night life, dawn routines, or weather broadly.',
    hatchSignals: ['sunset', 'golden hour', 'dusk light'],
    journalRoutes: ['journal.route:general.ordinary'],
    insightThemes: ['sunset places', 'evening transitions', 'changing light'],
    reflectionLenses: ['what the light transformed', 'how the day closed', 'where dusk was best seen'],
    goalTypes: ['watch sunset', 'take a dusk pause', 'find a golden-hour place'],
    quests: [
      p('light-detail', 'Keep the last light', 'Capture a real sunset, golden hour, or dusk where you watched it change.', 'nature.sunset', 'Photograph a real sunset or dusk'),
      q('dusk-pause', 1, 'Pause at the threshold', 'Stop for a few minutes as daylight changed and record how the transition felt.', ['A deliberate pause during sunset or dusk occurred', 'A concrete effect on mood, pace, or attention is included']),
      q('choose-the-view', 2, 'Find a place for sunset', 'Choose a place to watch the light change and record why the setting worked.', ['A place was deliberately chosen for sunset or dusk', 'A specific setting and its effect are described']),
      q('weekly-review', 3, 'Read the evening light', 'Review one dusk moment, what helps you notice the day ending, and what to repeat.', ['A real dusk example is named', 'A place or transition pattern is identified', 'One next evening-light intention is stated']),
    ],
  },
  {
    familyId: 'twinklet',
    role: 'Builds a relationship with the night sky through patient looking and small discoveries.',
    boundary: 'Stars, constellations, and night-sky observation—not late-night activity or sunset.',
    hatchSignals: ['starry sky', 'constellation', 'night-sky observation'],
    journalRoutes: ['journal.route:general.ordinary'],
    insightThemes: ['night-sky observations', 'constellations learned', 'dark-sky places'],
    reflectionLenses: ['what became visible', 'scale and wonder', 'conditions that helped'],
    goalTypes: ['look for stars', 'learn a constellation', 'visit a darker sky'],
    quests: [
      p('sky-detail', 'Find one point of light', 'Capture the real night sky, stars, or constellation you stopped to observe.', 'nature.stars', 'Photograph the real night sky'),
      q('learn-one-pattern', 1, 'Learn one sky pattern', 'Identify or investigate one constellation, planet, moon phase, or sky direction.', ['A specific night-sky object or pattern is named', 'One identification, location, or learned detail is included']),
      q('improve-the-view', 2, 'Make the sky easier to see', 'Change one thing about time, place, light, or patience and record what became visible.', ['A deliberate observing-condition change was made', 'Its effect on the real sky view is described']),
      q('weekly-review', 3, 'Read the night sky', 'Review one observation, what helped you see more, and the next thing to look for.', ['A real sky observation is named', 'A condition, curiosity, or visibility pattern is identified', 'One next sky-watching intention is stated']),
    ],
  },
  {
    familyId: 'tempesto',
    role: 'Turns storms into safely observed events with attention to change, power, and aftermath.',
    boundary: 'Thunderstorms and severe weather—not ordinary rain or general mood.',
    hatchSignals: ['storm', 'thunder or lightning', 'dramatic weather change'],
    journalRoutes: ['journal.route:general.difficult', 'journal.route:general.ordinary'],
    insightThemes: ['storm signals', 'safe observation', 'weather aftermath'],
    reflectionLenses: ['how the atmosphere changed', 'what safety required', 'the quiet after'],
    goalTypes: ['observe a storm safely', 'notice storm changes', 'prepare for severe weather'],
    quests: [
      q('storm-detail', 1, 'Read one storm signal', 'From a safe place, record real thunder, lightning, wind, cloud, pressure, or rain change.', ['A real storm or severe-weather event is described', 'A specific atmospheric or sensory signal is included']),
      q('safe-choice', 1, 'Make one storm-safe choice', 'Record one practical choice you made to stay safe or protect something during bad weather.', ['A concrete storm-safety or preparation action was completed', 'The weather risk or reason is clear']),
      q('before-and-after', 2, 'Notice the air after', 'Compare the atmosphere before and after a storm and keep one clear difference.', ['A real storm’s before-and-after conditions are described', 'A specific difference in light, air, sound, temperature, or surroundings is included']),
      q('weekly-review', 3, 'Read the storm pattern', 'Review one storm event, what helped you respond well, and what to prepare next time.', ['A real storm example is named', 'A response, safety, or atmosphere pattern is identified', 'One next preparation or observation intention is stated']),
    ],
  },
  {
    familyId: 'mistle',
    role: 'Finds detail and atmosphere in fog, low cloud, and half-seen familiar places.',
    boundary: 'Fog and mist—not rain, storms, or ordinary cloudy weather.',
    hatchSignals: ['foggy day', 'mist', 'low-visibility atmosphere'],
    journalRoutes: ['journal.route:general.ordinary'],
    insightThemes: ['foggy places', 'visibility and sound', 'familiar scenes transformed'],
    reflectionLenses: ['what disappeared', 'what became more noticeable', 'moving carefully through uncertainty'],
    goalTypes: ['notice fog', 'walk safely in mist', 'keep an atmospheric detail'],
    quests: [
      q('fog-detail', 1, 'Keep what the fog changed', 'Record real fog or mist and one visibility, sound, light, moisture, or distance detail.', ['Real fog or mist is described', 'A specific visibility, sound, light, moisture, or spatial detail is included']),
      q('familiar-made-strange', 1, 'See the familiar half-hidden', 'Notice a known place in fog and record what disappeared and what stood out.', ['A familiar real place in fog or mist is identified', 'A specific hidden or newly prominent detail is described']),
      q('move-with-care', 2, 'Adjust to low visibility', 'Make one safe route, pace, clothing, or timing choice because of fog and record it.', ['A concrete safe adjustment for fog or mist was made', 'The visibility condition or practical effect is described']),
      q('weekly-review', 3, 'Read the misty week', 'Review one fog moment, what it made you notice, and what you want to remember.', ['A real fog example is named', 'An attention, place, or safety pattern is identified', 'One next atmospheric-noticing intention is stated']),
    ],
  },
  {
    familyId: 'voyagle',
    role: 'Helps trips become coherent stories through anticipation, discovery, and return.',
    boundary: 'Trips and unfamiliar destinations—not local city discovery or daily commuting.',
    hatchSignals: ['trip or holiday', 'unfamiliar destination', 'travel day'],
    journalRoutes: ['journal.route:went_somewhere.travel'],
    insightThemes: ['trips taken', 'places discovered', 'travel styles and returns'],
    reflectionLenses: ['what changed away from home', 'the discovery worth keeping', 'how returning felt'],
    goalTypes: ['plan a trip', 'explore a destination', 'keep a travel memory'],
    quests: [
      q('travel-detail', 1, 'Keep one place-specific detail', 'Record a real trip or day away and one detail that could only belong to that place.', ['A real trip, holiday, or unfamiliar destination is clear', 'A specific local, sensory, cultural, landscape, or route detail is included']),
      q('small-discovery', 1, 'Make one unplanned discovery', 'Keep one place, food, view, conversation, or detour you did not expect.', ['A real unexpected travel discovery is described', 'The destination context and why it stood out are included']),
      q('travel-with-intention', 2, 'Choose what the trip is for', 'Make one deliberate travel choice around rest, curiosity, connection, or challenge and record it.', ['A real trip-related choice was made', 'The intention and its effect on the experience are described']),
      q('weekly-review', 3, 'Read the journey home', 'Review one travel moment, what the trip taught you, and what you want from the next journey.', ['A real travel example is named', 'A preference, learning, or change is identified', 'One next travel intention is stated']),
    ],
  },
  {
    familyId: 'ironette',
    role: 'Builds curiosity around major landmarks through architecture, history, and personal scale.',
    boundary: 'Landmarks and built icons—not museums generally, neighbourhood wandering, or travel logistics.',
    hatchSignals: ['famous landmark', 'architectural icon', 'historic built place'],
    journalRoutes: ['journal.route:went_somewhere.travel', 'journal.route:went_somewhere.city'],
    insightThemes: ['landmarks visited', 'architecture and scale', 'stories behind places'],
    reflectionLenses: ['how the structure felt in person', 'context behind the icon', 'the human detail'],
    goalTypes: ['visit a landmark', 'learn a landmark story', 'notice architecture'],
    quests: [
      q('landmark-detail', 1, 'Look past the postcard', 'Record a real landmark and one structural, material, scale, crowd, or setting detail.', ['A real landmark or notable built place is identified', 'A specific architectural, material, scale, human, or setting detail is included']),
      q('learn-the-story', 1, 'Find the story in the structure', 'Keep one thing you learned about why a landmark exists or what it has witnessed.', ['A specific landmark is named', 'A historical, design, cultural, or use-context detail is included']),
      q('change-the-viewpoint', 2, 'See the landmark differently', 'Approach, revisit, or view a landmark from a different angle and record what changed.', ['A real landmark was approached or revisited deliberately', 'A changed viewpoint or interpretation is described']),
      q('weekly-review', 3, 'Read the landmark trail', 'Review one built place, what makes it memorable beyond fame, and what to seek next.', ['A real landmark example is named', 'An architecture, history, or experience pattern is identified', 'One next landmark or built-place intention is stated']),
    ],
  },
  {
    familyId: 'neonpoko',
    role: 'Finds energy and human choreography in dense, bright, fast-moving city places.',
    boundary: 'Busy urban crossings and city spectacle—not neighbourhood familiarity or commuting routines.',
    hatchSignals: ['busy city crossing', 'neon streets', 'dense urban crowd'],
    journalRoutes: ['journal.route:went_somewhere.city', 'journal.route:went_somewhere.street'],
    insightThemes: ['city energy', 'crowds and movement', 'night streets'],
    reflectionLenses: ['how people moved together', 'light and density', 'where energy felt exciting or tiring'],
    goalTypes: ['visit a lively district', 'notice city movement', 'find a night street'],
    quests: [
      q('city-rhythm', 1, 'Read the crossing', 'Record a busy urban place and one detail of movement, timing, sound, crowd, or light.', ['A real busy city place is identified', 'A specific movement, timing, sound, crowd, or lighting detail is included']),
      q('neon-detail', 1, 'Keep one electric detail', 'Notice one sign, reflection, storefront, screen, or colour that shaped the street.', ['A real urban street or district is clear', 'A specific light, sign, reflection, storefront, screen, or colour detail is included']),
      q('step-out-of-the-flow', 2, 'Find stillness inside the rush', 'Pause safely in a busy district and record what became visible when you stopped moving.', ['A deliberate safe pause in a busy urban place occurred', 'A detail noticed only after slowing down is included']),
      q('weekly-review', 3, 'Read the city current', 'Review one high-energy city moment, how it affected you, and which urban experience to seek next.', ['A real city example is named', 'An energy, crowd, light, or attention pattern is identified', 'One next urban intention is stated']),
    ],
  },
  {
    familyId: 'skysette',
    role: 'Turns observatories and high viewpoints into encounters with scale, horizon, and perspective.',
    boundary: 'Observatories and elevated built viewpoints—not mountain hiking, landmarks broadly, or stargazing alone.',
    hatchSignals: ['observatory', 'high city viewpoint', 'panoramic horizon'],
    journalRoutes: ['journal.route:went_somewhere.travel', 'journal.route:went_somewhere.city'],
    insightThemes: ['high viewpoints', 'observatories', 'perspective and horizons'],
    reflectionLenses: ['what distance made visible', 'how scale changed perspective', 'the route upward'],
    goalTypes: ['visit a viewpoint', 'find an observatory', 'see a place from above'],
    quests: [
      q('view-from-above', 1, 'See the place from above', 'Record a real observatory or high viewpoint and one pattern that became visible.', ['A real elevated viewpoint or observatory is identified', 'A specific horizon, layout, scale, weather, or distance detail is included']),
      q('orientation-detail', 1, 'Find your bearings', 'From a high viewpoint, identify one direction, landmark, route, or relationship between places.', ['A real elevated view is described', 'A specific direction, landmark, route, or spatial relationship is included']),
      q('change-perspective', 2, 'Let distance change the story', 'Keep one thought or feeling that shifted when you saw a place at a larger scale.', ['A real high-view or observatory experience is clear', 'A specific changed interpretation, feeling, or sense of scale is described']),
      q('weekly-review', 3, 'Read the horizon line', 'Review one viewpoint, what perspective it gave you, and where you want to look from next.', ['A real viewpoint example is named', 'A scale, orientation, or perspective pattern is identified', 'One next viewpoint intention is stated']),
    ],
  },
];

/**
 * Stable Journey identities for the playable specialist families. This lives
 * beside their quest catalogue so Node-only quest verification can consume it
 * without loading UI or rotating-content modules.
 */
export const SPECIALIST_JOURNEY_ID_BY_FAMILY_ID = new Map<KatchimeraFamilyId, string>([
  ['crumbun', 'crumbun-baking-ritual'],
  ['hayhorn', 'hayhorn-ingredient-origins'],
  ['crustling', 'crustling-pizza-ritual'],
  ['nigirimp', 'nigirimp-japanese-food-discovery'],
  ['noodloo', 'noodloo-noodle-trail'],
  ['sundael', 'sundael-dessert-occasions'],
  ['bobaloo', 'bobaloo-playful-drinks'],
  ['voltstep', 'voltstep-cardio-rhythm'],
  ['pulsepounce', 'pulsepounce-playful-agility'],
  ['museling', 'museling-creative-practice'],
  ['pixooka', 'pixooka-intentional-play'],
  ['glimmuse', 'glimmuse-art-encounters'],
  ['shellio', 'shellio-water-connection'],
  ['petalimp', 'petalimp-garden-care'],
  ['fernip', 'fernip-woodland-connection'],
  ['amberleaf', 'amberleaf-autumn-turning'],
  ['blossle', 'blossle-spring-return'],
  ['peakle', 'peakle-hiking-confidence'],
  ['stillo', 'stillo-still-water'],
  ['drizzlet', 'drizzlet-rainy-days'],
  ['driftkin', 'driftkin-snow-days'],
  ['duskle', 'duskle-evening-light'],
  ['twinklet', 'twinklet-night-sky'],
  ['tempesto', 'tempesto-storm-awareness'],
  ['mistle', 'mistle-fog-awareness'],
  ['voyagle', 'voyagle-travel-stories'],
  ['ironette', 'ironette-landmark-context'],
  ['neonpoko', 'neonpoko-city-energy'],
  ['skysette', 'skysette-high-perspective'],
]);

export const bespokeFamilyQuestPackByFamilyId = new Map(
  BESPOKE_FAMILY_QUEST_PACKS.map((pack) => [pack.familyId, pack])
);

export function bespokeQuestIdsForFamily(familyId: KatchimeraFamilyId): string[] {
  const pack = bespokeFamilyQuestPackByFamilyId.get(familyId);
  return pack?.quests.map((quest) => `quest-${familyId}-${quest.suffix}`) ?? [];
}
