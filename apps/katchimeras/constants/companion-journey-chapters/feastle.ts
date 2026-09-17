import type { CompanionJourneyChapterDefinition } from '@/types/companion-journey-chapter';

/** Seven chapters, with delivery closing scenes: warmth, belonging and a signal beyond the Mist. */
export const FEASTLE_CHAPTER: CompanionJourneyChapterDefinition = {
  "familyId": "feastle",
  "chapterId": "feastle-chapter-1",
  "title": "The Table We Remember",
  "purpose": "Bring warmth back to the hearth, make room for lost friends, and follow the memory of a meal the Mist could not keep.",
  "reflectMs": 0,
  "dayOne": {
    "flowId": "feastle-day-one",
    "runId": "journey:feastle:day-1"
  },
  "generatorId": "hearth-pantry",
  "evidence": "none",
  "lines": {
    "foreshadow": "There is something I remember when the oven warms. Sit with me when you are ready.",
    "complete": "The hearth is ours again. There is always a place for you, and one for the next friend we find.",
    "checkIn": [
      [
        "noticed",
        "I noticed a small kindness"
      ],
      [
        "rest",
        "I took a quiet pause"
      ]
    ],
    "lifeIcon": "fork.knife"
  },
  "episodes": [
    {
      "id": "day-1",
      "title": "A Seat Kept Warm",
      "flavour": "companion",
      "dayOne": true,
      "unlock": [
        {
          "kind": "day_one_complete"
        }
      ]
    },
    {
      "id": "day-2",
      "title": "The Cold Hearth",
      "flavour": "adventure",
      "reflectMs": 0,
      "unlock": [
        {
          "kind": "episode_complete",
          "episodeId": "day-1"
        }
      ],
      "beats": [
        {
          "kind": "ask",
          "id": "day-2.table-question",
          "prompt": "The oven remembers being warm. I can hear it in the stones. Before the Mist, I used to leave a small plate on the step. Who might need it now?",
          "options": [
            {
              "id": "friend",
              "label": "A friend we have not found",
              "reply": "Then we shall keep the light where they can see it."
            },
            {
              "id": "us",
              "label": "Perhaps we do",
              "reply": "Us counts. It always did."
            },
            {
              "id": "anyone",
              "label": "Whoever comes along",
              "reply": "An open invitation. I like those."
            }
          ]
        },
        {
          "kind": "end",
          "text": "Let us make two Snacks. One for here, one for the doorstep."
        }
      ],
      "consequences": [
        {
          "kind": "garden_orders",
          "objectiveId": "feastle:chapter-1:doorstep-snacks:objective",
          "storyArcId": "feastle-chapter-1",
          "orders": [
            {
              "id": "feastle:chapter-1:doorstep-snacks",
              "title": "A plate on the step",
              "description": "Let us make two Snacks. One for here, one for the doorstep.",
              "requirements": [
                {
                  "definitionId": "food:table:2",
                  "quantity": 2
                }
              ],
              "coins": 25
            }
          ]
        }
      ],
      "bond": 0
    },
    {
      "id": "day-2-return",
      "deliveryReturnFor": "day-2",
      "title": "The Cold Hearth",
      "flavour": "companion",
      "reflectMs": 0,
      "unlock": [
        {
          "kind": "episode_complete",
          "episodeId": "day-2"
        },
        {
          "kind": "orders_served",
          "orderIds": [
            "feastle:chapter-1:doorstep-snacks"
          ]
        }
      ],
      "beats": [
        {
          "kind": "say",
          "id": "delivery.thanks",
          "text": "The hearth is warm again. Feastle sets one snack beside you and carries the other to the doorstep. “There. A place for us, and a welcome for whoever finds the light. Thank you for helping me begin again.”"
        },
        {
          "kind": "end",
          "text": "Another little piece of our home is back. I am glad we did this together."
        }
      ]
    },
    {
      "id": "day-3",
      "title": "The Bowl With Two Handles",
      "flavour": "personal",
      "reflectMs": 0,
      "unlock": [
        {
          "kind": "episode_complete",
          "episodeId": "day-2-return"
        },
        {
          "kind": "orders_served",
          "orderIds": [
            "feastle:chapter-1:doorstep-snacks"
          ]
        },
        {
          "kind": "since_previous",
          "ms": 7200000
        }
      ],
      "beats": [
        {
          "kind": "ask",
          "id": "day-3.table-question",
          "prompt": "There is a bowl beneath the flour cloth. Two handles, one on either side. I cannot remember who held the other. What would you keep from a table you loved?",
          "options": [
            {
              "id": "taste",
              "label": "A familiar taste",
              "reply": "Some memories arrive without pictures."
            },
            {
              "id": "voice",
              "label": "Someone’s voice",
              "reply": "I think mine is a laugh. A small one."
            },
            {
              "id": "feeling",
              "label": "How it felt to be there",
              "reply": "Warmth can remember for us."
            }
          ]
        },
        {
          "kind": "end",
          "text": "The plate on the step is ready. The bowl can wait here until its other person returns."
        }
      ]
    },
    {
      "id": "day-4",
      "title": "Enough for One More",
      "flavour": "relationship",
      "reflectMs": 0,
      "unlock": [
        {
          "kind": "episode_complete",
          "episodeId": "day-3"
        },
        {
          "kind": "since_previous",
          "ms": 7200000
        }
      ],
      "beats": [
        {
          "kind": "ask",
          "id": "day-4.table-question",
          "prompt": "A Wisp stopped at the doorstep. It did not take the Snack. It circled the empty chair. What makes a place feel welcoming?",
          "options": [
            {
              "id": "space",
              "label": "Room to be myself",
              "reply": "No special version of you is required."
            },
            {
              "id": "question",
              "label": "Someone asking what I need",
              "reply": "We can ask before we fill the bowl."
            },
            {
              "id": "quiet",
              "label": "Being allowed to be quiet",
              "reply": "Then we will let the fire do the talking."
            }
          ]
        },
        {
          "kind": "end",
          "text": "A Dish and a Cupcake for the table. Something ordinary, and something just because."
        }
      ],
      "consequences": [
        {
          "kind": "garden_orders",
          "objectiveId": "feastle:chapter-1:welcome-table:objective",
          "storyArcId": "feastle-chapter-1",
          "orders": [
            {
              "id": "feastle:chapter-1:welcome-table",
              "title": "A welcome at the hearth",
              "description": "A Dish and a Cupcake for the table. Something ordinary, and something just because.",
              "requirements": [
                {
                  "definitionId": "food:table:3",
                  "quantity": 1
                },
                {
                  "definitionId": "food:dessert:3",
                  "quantity": 1
                }
              ],
              "coins": 35
            }
          ]
        }
      ],
      "bond": 0
    },
    {
      "id": "day-4-return",
      "deliveryReturnFor": "day-4",
      "title": "Enough for One More",
      "flavour": "companion",
      "reflectMs": 0,
      "unlock": [
        {
          "kind": "episode_complete",
          "episodeId": "day-4"
        },
        {
          "kind": "orders_served",
          "orderIds": [
            "feastle:chapter-1:welcome-table"
          ]
        }
      ],
      "beats": [
        {
          "kind": "say",
          "id": "delivery.thanks",
          "text": "Feastle places your gift on the table and straightens the empty chair. “It feels less empty now. Someone will find their way here. Until then, we will keep a place for them.”"
        },
        {
          "kind": "end",
          "text": "Another little piece of our home is back. I am glad we did this together."
        }
      ]
    },
    {
      "id": "day-5",
      "title": "A Recipe Without Numbers",
      "flavour": "adventure",
      "reflectMs": 0,
      "unlock": [
        {
          "kind": "episode_complete",
          "episodeId": "day-4-return"
        },
        {
          "kind": "orders_served",
          "orderIds": [
            "feastle:chapter-1:welcome-table"
          ]
        },
        {
          "kind": "since_previous",
          "ms": 14400000
        }
      ],
      "beats": [
        {
          "kind": "ask",
          "id": "day-5.table-question",
          "prompt": "The Wisp left a scrap beside the bowl. No amounts, only three words: share what remains. Does that sound like a recipe to you?",
          "options": [
            {
              "id": "yes",
              "label": "A very good one",
              "reply": "Then we already know how to begin."
            },
            {
              "id": "story",
              "label": "More like a story",
              "reply": "Maybe recipes are stories that you can share."
            },
            {
              "id": "try",
              "label": "We could try it",
              "reply": "A small experiment. No perfect result needed."
            }
          ]
        },
        {
          "kind": "end",
          "text": "The table is set. The scrap smells faintly of rain and apples. Someone beyond the Mist remembers this hearth."
        }
      ]
    },
    {
      "id": "day-6",
      "title": "The Lantern Supper",
      "flavour": "companion",
      "reflectMs": 0,
      "unlock": [
        {
          "kind": "episode_complete",
          "episodeId": "day-5"
        },
        {
          "kind": "since_previous",
          "ms": 14400000
        }
      ],
      "beats": [
        {
          "kind": "ask",
          "id": "day-6.table-question",
          "prompt": "I used to think a feast needed every chair filled. Now I think it begins when someone knows they can come back. What should our lantern mean?",
          "options": [
            {
              "id": "return",
              "label": "You can come back",
              "reply": "Even after a long time. Especially then."
            },
            {
              "id": "rest",
              "label": "You can rest here",
              "reply": "We will keep one corner quiet."
            },
            {
              "id": "enough",
              "label": "You are enough already",
              "reply": "That one belongs above the door."
            }
          ]
        },
        {
          "kind": "end",
          "text": "Let us make a Meal for the lantern supper. We can leave the extra bowl beside it."
        }
      ],
      "consequences": [
        {
          "kind": "garden_orders",
          "objectiveId": "feastle:chapter-1:lantern-supper:objective",
          "storyArcId": "feastle-chapter-1",
          "orders": [
            {
              "id": "feastle:chapter-1:lantern-supper",
              "title": "The lantern supper",
              "description": "Let us make a Meal for the lantern supper. We can leave the extra bowl beside it.",
              "requirements": [
                {
                  "definitionId": "food:table:4",
                  "quantity": 1
                }
              ],
              "coins": 50
            }
          ]
        }
      ],
      "bond": 0
    },
    {
      "id": "day-6-return",
      "deliveryReturnFor": "day-6",
      "title": "The Lantern Supper",
      "flavour": "companion",
      "reflectMs": 0,
      "unlock": [
        {
          "kind": "episode_complete",
          "episodeId": "day-6"
        },
        {
          "kind": "orders_served",
          "orderIds": [
            "feastle:chapter-1:lantern-supper"
          ]
        }
      ],
      "beats": [
        {
          "kind": "say",
          "id": "delivery.thanks",
          "text": "Feastle follows the warm scent to the edge of the Mist. “It reached further than I hoped. Somewhere out there, a friend might be remembering the way home.”"
        },
        {
          "kind": "end",
          "text": "Another little piece of our home is back. I am glad we did this together."
        }
      ]
    },
    {
      "id": "day-7",
      "title": "The Place We Keep",
      "flavour": "relationship",
      "reflectMs": 0,
      "unlock": [
        {
          "kind": "episode_complete",
          "episodeId": "day-6-return"
        },
        {
          "kind": "orders_served",
          "orderIds": [
            "feastle:chapter-1:lantern-supper"
          ]
        },
        {
          "kind": "since_previous",
          "ms": 14400000
        }
      ],
      "beats": [
        {
          "kind": "ask",
          "id": "day-7.table-question",
          "prompt": "The lantern reaches farther tonight. For a moment I saw another light answering it. I still do not know who held that bowl. But I know what to do until we find them. What shall we keep ready?",
          "options": [
            {
              "id": "chair",
              "label": "An empty chair",
              "reply": "An empty chair can be a promise."
            },
            {
              "id": "meal",
              "label": "Something warm",
              "reply": "We can make it together."
            },
            {
              "id": "story",
              "label": "A story to share",
              "reply": "Ours has a beginning now."
            }
          ]
        },
        {
          "kind": "end",
          "text": "The hearth is warm, the table is set, and the Mist has not taken either of us. Tomorrow, we keep looking for the next light."
        }
      ]
    }
  ]
};
