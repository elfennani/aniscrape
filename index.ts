import { exec } from 'child_process';
import { GraphQLClient } from 'graphql-request'
import inquirer from 'inquirer'
import { exit } from 'process';
import readline from 'readline'

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (prompt: string) => new Promise(resolve => rl.question(prompt, resolve));

const client = new GraphQLClient("https://api.allanime.day/api");
const query_shows = `
  query(
    $search: SearchInput
    $limit: Int
    $page: Int
    $translationType: VaildTranslationTypeEnumType
    $countryOrigin: VaildCountryOriginEnumType
  ) {
    shows(
      search: $search
      limit: $limit
      page: $page
      translationType: $translationType
      countryOrigin: $countryOrigin
    ) {
      edges {
        _id
        name
        availableEpisodes
        __typename
      }
    }
  }
`;

const query_episodes = `
  query ($showId: String!) {
    show(_id: $showId) {
      _id availableEpisodesDetail
    }
  }
`;

const query_episode = `
  query ($showId: String!, $translationType: VaildTranslationTypeEnumType!, $episodeString: String!) {
    episode(
      showId: $showId
      translationType: $translationType
      episodeString: $episodeString
    ) {
      episodeString
      sourceUrls
    }
  }
`

interface QueryShows {
  shows: {
    edges: {
      _id: string,
      name: string,
      availableEpisodes: { sub: number, dub: number, raw: number },
      __typename: string
    }[]
  }
}

interface QueryEpisodes {
  show: {
    _id: string;
    availableEpisodesDetail: {
      sub: string[];
      dub: string[];
      raw: string[];
    };
  };
}

interface QueryEpisode {
  episode: {
    episodeString: string;
    sourceUrls: {
      sourceUrl: string;
      priority: number;
      sourceName: string;
      type: string;
      className: string;
      streamerId: string;
      sandbox?: string;
      downloads?: {
        sourceName: string;
        downloadUrl: string;
      };
    }[];
  };
}

const m3u8_providers = ["Luf-mp4", "Default"];
const mp4_providers = ["S-mp4", "Kir", "Sak"];

(async () => {
  const search = (await question("Anime name: ") as string).replace("\n", "")
  if (!search) exit(1)

  const variables = {
    search: { allowAdult: false, allowUnknown: false, query: search },
    limit: 40,
    page: 1,
    translationType: "sub",
    countryOrigin: "ALL"
  };

  const headers = {
    Referer: 'https://allanime.to',
    Agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/121.0'
  }

  const data: QueryShows = await client.request(query_shows, variables, headers)

  if (!data.shows.edges.length) {
    console.error("Nothing found!")
    exit(1)
  }

  type Show = QueryShows["shows"]["edges"][0]
  const { show }: { show: Show } = await inquirer.prompt({
    type: "list",
    name: "show",
    message: "Select a show",
    choices: data.shows.edges
      .map(show => ({ name: `${show.name} (${show.availableEpisodes.sub} Episodes)`, value: show }))
  })
  const showId = show._id

  const showData: QueryEpisodes = await client.request(query_episodes, { showId }, headers)
  const { ep: episodeString } = await inquirer.prompt<{ ep: string }>({
    type: "list",
    name: "ep",
    message: "Select an episode",
    choices: showData.show.availableEpisodesDetail.sub.sort((a, b) => Number(a) - Number(b)),
    loop: false
  })

  const episode = {
    showId,
    translationType: "sub",
    episodeString
  }

  const episodeData: QueryEpisode = await client.request(query_episode, episode, headers)

  const providers = episodeData.episode.sourceUrls
    .filter(url => [...mp4_providers, m3u8_providers].includes(url.sourceName))
    .reduce((prev, url) => ({
      ...prev,
      [url.sourceName]: "https://allanime.day" + url.sourceUrl.replace("--", "").match(/.{1,2}/g)?.map(replaceToText).join("").replace("clock", "clock.json")
    }), {} as Record<string, string>)

  for (let i = 0; i < Object.keys(providers).length; i++) {
    try {
      const provider = providers[Object.keys(providers)[i]];
      const res = await fetch(provider)
      if (res.status != 200) throw new Error()

      const json = await res.json();
      const url = json.links[0].src
      exec(`vlc ${url}`)
      break;
    } catch (error) {
      continue;
    }
  }
})()

const replaceToText = (string: string) => {
  if (string == "01") return "9"
  if (string == "08") return "0"
  if (string == "05") return "="
  if (string == "0a") return "2"
  if (string == "0b") return "3"
  if (string == "0c") return "4"
  if (string == "07") return "?"
  if (string == "00") return "8"
  if (string == "5c") return "d"
  if (string == "0f") return "7"
  if (string == "5e") return "f"
  if (string == "17") return "/"
  if (string == "54") return "l"
  if (string == "09") return "1"
  if (string == "48") return "p"
  if (string == "4f") return "w"
  if (string == "0e") return "6"
  if (string == "5b") return "c"
  if (string == "5d") return "e"
  if (string == "0d") return "5"
  if (string == "53") return "k"
  if (string == "1e") return "&"
  if (string == "5a") return "b"
  if (string == "59") return "a"
  if (string == "4a") return "r"
  if (string == "4c") return "t"
  if (string == "4e") return "v"
  if (string == "57") return "o"
  if (string == "51") return "i"
  return string
}
