export interface KabboQuote {
  text: string;
}

// Short phrases spoken by ||kabbo and recorded by Lucy Lloyd and Wilhelm Bleek
// during his residence at their Mowbray home (1871–1873). Published in
// Specimens of Bushman Folklore (Bleek & Lloyd, 1911) and therefore in the
// public domain worldwide. Sources cited on the About page draw from three
// Neil Rusch papers (2016) that discuss and quote these passages; see
// /about > Sources.
export const KABBO_QUOTES: KabboQuote[] = [
  // The long walk home – from "||kabbo's Intended Return Home"
  { text: 'I should reach my place, when the trees are dry.' },
  { text: 'It is a great road; it is long.' },
  { text: 'I shall walk, letting the flowers become dry while I still follow the path.' },
  { text: 'I am waiting that the moon may turn back for me.' },
  { text: 'I must set my feet forward in the path.' },
  { text: 'I must go together with the warm sun.' },
  { text: 'The earth becomes hot, while I still am going along halfway.' },
  { text: 'Then, autumn will quickly be upon us there; when I am sitting at my place.' },
  { text: 'He is the one who thinks of his place, that he must be the one to return.' },
  { text: 'A man\'s name passes behind the mountains\' back.' },
  { text: 'I feel that my name floats along the road.' },

  // The story as wind
  { text: 'A story is the wind.' },
  { text: 'I feel that a story is the wind.' },
  { text: 'I do merely listen, watching for a story.' },
  { text: 'I am listening with all my ears.' },
  { text: 'These are those to which I am listening with all my ears.' },
  { text: 'I want to hear – I must wait listening.' },
  { text: 'The tale which is told nicely, I did get it, as it lay in my thinking strings.' },
  { text: 'I must sit a little, cooling my arms; that the fatigue may go out of them.' },

  // Thoughts and thinking – from the "give me thread" chiasmus
  { text: 'My thoughts spoke to me. Therefore my mouth speaks to thee.' },
  { text: 'He thought, for his thoughts spoke.' },
  { text: 'I thinking lay. I lay upon the bed.' },

  // Running and the hare – from the persistence-hunting digression
  { text: 'I was fresh for running; I felt that I could, running, catch things.' },
  { text: 'When I walk on the path I shall also run.' },
  { text: 'I might chasing, cause them to die with the sun.' },
  { text: 'I must chase it, with my body.' },
  { text: 'I feel that I was the one who chased it.' },
  { text: 'It would spring up, running into the sun, while I ran following it.' },
  { text: 'I felt that I had not seen a springbok. For, I saw a hare.' },

  // Rain, dreams and presentiment
  { text: 'The rain must first fall.' },
  { text: 'I dreamt that I spoke. The rain consented.' },
  { text: 'The she rain is drawing her breath, which resembles mist.' },
  { text: 'I think that !kwabba-an called my name, for I sneeze.' },

  // Fellowship, visiting, stories
  { text: 'I do think of visits; I ought to visit; I ought to talk with my fellow men.' },
  { text: 'One man feels the other who comes.' },

  // The moon and the sun
  { text: 'The moon is another thing. The sun is different.' },
];

export function pickKabboQuote(): KabboQuote {
  return KABBO_QUOTES[Math.floor(Math.random() * KABBO_QUOTES.length)];
}
