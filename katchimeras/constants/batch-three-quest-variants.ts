type Variant = { id: string; title: string; hint: string };

const variants = (
  title: string,
  hint: string,
  alternateTitle: string,
  alternateHint: string,
  returnTitle: string,
  returnHint: string,
): readonly Variant[] => [
  { id: 'original', title, hint },
  { id: 'alternate', title: alternateTitle, hint: alternateHint },
  { id: 'return', title: returnTitle, hint: returnHint },
];

/**
 * Repeatable real-world invitations for the learning, screen-story, cultural
 * curiosity, and music families. Each return changes the lens—not merely the
 * wording—while preserving the quest's evidence route and progression stage.
 */
export const BATCH_THREE_QUEST_VARIANTS: Readonly<Record<string, readonly Variant[]>> = {
  'quest-read-book': variants(
    'Spend time with a book',
    'Read, listen to, or read along with part of a book. Keep its title and one idea, detail, or feeling that stayed with you.',
    'Return to a text',
    'Spend a little time with a book you have already begun, in the format that works for you. Keep one thing you noticed this time.',
    'Try a different format',
    'Explore part of a book through print, large print, audio, read-aloud, or another accessible format. Keep one detail that held your attention.',
  ),
  'quest-pagelet-learning-note': variants(
    'Keep one useful idea',
    'Write or record one thing you learned and why it feels useful, interesting, or worth remembering.',
    'Explain it in your own words',
    'Choose one idea you met today and keep a plain-language explanation that makes sense to you.',
    'Notice what changed',
    'Keep one idea that corrected, complicated, or added to something you thought before.',
  ),
  'quest-pagelet-curiosity-note': variants(
    'Follow one real question',
    'Keep a question you genuinely care about, one place you looked, and one thing you found.',
    'Make a question smaller',
    'Turn a broad curiosity into one answerable question, then keep the most useful thing you found.',
    'Keep an unanswered edge',
    'Follow a question briefly, then note what became clearer and what you still do not know.',
  ),
  'quest-pagelet-weekly-review': variants(
    'Gather the week’s ideas',
    'Review what you read, heard, or learned. Keep one idea and one question you want to carry forward.',
    'Review how learning fitted',
    'Notice which formats, times, or supports made curiosity easier this week and choose one to use again.',
    'Choose what not to finish',
    'Review the week’s open books and questions. Choose one to continue and one you can leave without guilt.',
  ),

  'quest-flickerbun-watch': variants(
    'Choose a screen story on purpose',
    'Watch some of a film, episode, documentary, or short you deliberately chose. Keep its title and one worthwhile detail.',
    'Return to something familiar',
    'Rewatch some of a screen story you know and keep one detail that landed differently this time.',
    'Make watching easier',
    'Choose a screen story with the subtitles, audio description, pacing, or breaks you need. Keep one detail you enjoyed or noticed.',
  ),
  'quest-flickerbun-scene-note': variants(
    'Keep one screen-story moment',
    'Write or record one scene, image, line, feeling, or idea that stayed with you—and what made it linger.',
    'Notice how a scene works',
    'Keep one detail of sound, performance, colour, framing, or pacing and what it helped the scene convey.',
    'Keep your honest response',
    'Note one moment that worked for you, did not work for you, or left you unsure, and why.',
  ),
  'quest-flickerbun-new-perspective': variants(
    'Watch beyond the familiar',
    'Try some of a screen story outside your usual genre, style, place, or viewpoint. Note what felt different.',
    'Follow another viewpoint',
    'Choose a screen story centred on an experience or perspective less familiar to you. Keep one thing you learned or questioned.',
    'Look past the recommendation loop',
    'Choose something you found through a person, library, festival, review, or catalogue rather than your usual feed. Note what the change opened up.',
  ),
  'quest-flickerbun-weekly-review': variants(
    'Read the week’s watching',
    'Review what you chose to watch, what stayed with you, and which choice felt worth your time.',
    'Review attention, not hours',
    'Notice when watching felt chosen, absorbing, restful, restless, or simply neutral. Keep one useful pattern without judging the amount.',
    'Choose the next screen story',
    'Review what you stopped, finished, or returned to, then name one kind of viewing you want more—or less—of next.',
  ),

  'quest-relicoon-object-note': variants(
    'Follow one object’s story',
    'Choose an object, artwork, or building and keep one detail about who made, used, kept, or interpreted it.',
    'Read the label twice',
    'Choose one cultural object or image. Keep one detail from its description and one question the description leaves open.',
    'Notice what is missing',
    'Choose one object or story and note whose perspective is present, whose may be absent, or what remains uncertain.',
  ),
  'quest-relicoon-museum-visit': variants(
    'Explore a cultural place',
    'Visit an accessible museum, gallery, heritage place, archive, or online collection. Keep its name and one thing that caught your attention.',
    'Return with one question',
    'Revisit a cultural place or collection with one question in mind. Keep one detail that helped, complicated, or redirected it.',
    'Use a free or nearby collection',
    'Explore a public display, library collection, local landmark, or free online archive. Keep one specific trace of its story.',
  ),
  'quest-relicoon-context-note': variants(
    'Add the human context',
    'Follow one cultural detail far enough to learn who made, used, protected, collected, changed, or contested it.',
    'Check the source',
    'Keep one cultural claim, where it came from, and one reason you trust it, question it, or want another source.',
    'Hold two accounts together',
    'Compare two descriptions of the same object, event, place, or tradition. Note one agreement, difference, or uncertainty.',
  ),
  'quest-relicoon-weekly-review': variants(
    'Gather the week’s traces',
    'Review the objects, places, and stories you followed. Choose one cultural thread worth carrying onward.',
    'Review the missing pieces',
    'Look back at what you learned and keep one gap, disputed point, or absent perspective you want to remember.',
    'Review how you explored',
    'Notice which places, formats, sources, or access supports helped this week and choose one realistic next route.',
  ),

  'quest-encora-listening-note': variants(
    'Listen for one detail',
    'Listen to some music with the attention and volume that feel comfortable. Keep one sound, shift, lyric, or feeling you noticed.',
    'Follow one musical layer',
    'Listen for one voice, instrument, rhythm, texture, or silence. Keep what it did in the music.',
    'Listen in an accessible way',
    'Use lyrics, a visualiser, haptics, hearing support, a comfortable volume, or a quiet setting. Keep one detail the support helped you notice.',
  ),
  'quest-encora-music-moment': variants(
    'Name the music in this moment',
    'Keep a note about a song, performance, or sound that met—or changed—the mood today.',
    'Keep a shared sound',
    'Notice music heard with, from, or because of someone else. Keep the moment without including their private details.',
    'Choose quiet if quiet fits',
    'Notice whether music or quiet better matched this moment, then keep what that choice gave you.',
  ),
  'quest-encora-practice-note': variants(
    'Return to the sound',
    'Make, sing, hum, tap, or practise for a manageable while. Keep one thing that shifted through repetition.',
    'Make the practice smaller',
    'Try one phrase, rhythm, movement, breath, or technical detail. Keep what became easier, clearer, or still awkward.',
    'Adapt the way you make music',
    'Change the pace, volume, tool, posture, notation, or support to suit you. Note how the adaptation affected the experience.',
  ),
  'quest-encora-weekly-review': variants(
    'Hear the week’s pattern',
    'Review what you listened to, made, shared, or chose not to hear. Keep one musical direction worth repeating.',
    'Review comfort and access',
    'Notice which volumes, settings, tools, formats, or breaks helped music fit this week and choose one to keep.',
    'Review without performing',
    'Keep one moment of listening or making that mattered, without rating your taste, talent, output, or consistency.',
  ),
};
