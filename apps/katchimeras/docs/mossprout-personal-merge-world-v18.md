# Mossprout Personal Merge World v18

## Product contract

Mossprout owns the current persistent Merge World. The board is the playable
history of the player's relationship with Mossprout, not a shared board or a
generic game hub.

Three progress tracks remain separate:

- **Relationship:** Stranger, Familiar, Friend, Close Friend, Confidant, and
  Kindred. It grows from distinct days, conversations, journeys, optional
  real-life goals, insights, and major story moments.
- **World:** merging, orders, chains, cell awakenings, and landmarks.
- **Discoveries:** Wisps, memories, photographs, insights, cards, souvenirs,
  and rare board artifacts.

Merge orders never award Bond. A conversation may award Bond only once per
Mossprout per local day. More merging can improve the garden, but cannot grind
the relationship.

## Personal board and economy

The board remains 7×9 for compatibility with the proven renderer. Twenty cells
are initially playable. Twelve Rootbound cells and eighteen Garden Growth cells
carry the existing 28-active-day Mossprout arc. Thirteen cells are dormant and
reserved for future Mossprout content; foreign companions cannot annex them.

There is no universal Energy meter in normal play. Each generator owns:

- `capacity`
- `charges`
- `restDurationMs`
- `restStartedAt`

The default Wild Garden has 12 charges and rests for 18 minutes after depletion.
A full board does not consume a charge. Authored real-life interactions may
grant a small generator refresh later, but life inputs do not become generic
Energy.

## Chapters and gates

The authored chapter read model is:

| Active days | Chapter | Theme | Region |
|---|---|---|---|
| 1–7 | The Quiet Patch | Noticing | Garden clearing |
| 8–14 | The Returning Pond | Curiosity | Old pond |
| 15–21 | The Memory Nursery | Patterns | Forgotten greenhouse |
| 22–28 | Heartwood | Growth | Ancient grove |

Garden Growth opens in clusters at authored journey beats. Rootbound cells use
typed life signals such as distinct active days, relationship stage, completed
journeys, nature memories, goal direction, or owned Wisps. Memory, focus, and
Wisp gates may use an authored active-day fallback; friendship, journey, and
mastery gates never fall back to Merge play.

## Hub and first session

Mossprout's hub presents one primary interaction at a time. The persistent dock
contains Garden, Journey, and Discoveries. Discoveries opens the shared history
archive directly.

The first session asks three lightweight questions while the Egg visibly grows,
hatches Mossprout, teaches one Seed + Seed → Sprout merge, serves one request,
and returns to Mossprout. The
closing beat explains that more merging grows the garden while some things need
another day.

## Persistence and privacy

`MergeWorldState` v18 records `ownerCharacterId: 'mossprout'` and the generator
capacity fields. Pre-v18 internal Merge snapshots intentionally reset to a clean
personal world. Home history, journals, relationship state, Wisps, and all other
persistence domains remain intact.

Only privacy-safe progress signals enter Merge state: stable day identifiers,
counts/stages, Wisp identifiers, gate receipts, and memory references. Journal
text, media URIs, place names, and coordinates stay outside the Merge snapshot.

## Verification contract

- A zero-valued compatibility Energy field cannot block a generator tap.
- A depleted generator returns `generator_resting` and refills from timestamps.
- Serving an order emits no friendship receipt and grants no Energy.
- Repeated same-day conversations do not award additional Bond.
- The production Merge route always opens Mossprout's world.
- The FTUE receipt allowlist is registered as script v17.
