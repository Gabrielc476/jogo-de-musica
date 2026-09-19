declare module 'yt-search' {
  interface VideoSearchResult {
    type: 'video';
    videoId: string;
    url: string;
    title: string;
    description: string;
    image: string;
    thumbnail: string;
    seconds: number;
    timestamp: string;
    duration: {
      toString(): string;
      seconds: number;
      timestamp: string;
    };
    views: number;
    genre: string;
    author: {
      name: string;
      url: string;
    };
  }

  interface SearchResult {
    all: any[];
    videos: VideoSearchResult[];
    live: any[];
    playlists: any[];
    channels: any[];
    accounts: any[];
  }

  function ytSearch(query: string | { videoId: string }): Promise<any>;

  export default ytSearch;
}
