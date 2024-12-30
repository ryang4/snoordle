import { Context, JobContext, Post } from '@devvit/public-api';

export class RedditFetcher {
  private readonly stopwords = new Set([
    'the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have',
    'i', 'it', 'for', 'not', 'on', 'with', 'he', 'as', 'you',
    'do', 'at', 'this', 'but', 'his', 'by', 'from', 'they',
    'we', 'say', 'her', 'she', 'or', 'an', 'will', 'my', 'one',
    'all', 'would', 'there', 'their', 'what', 'so', 'up', 'out',
    'if', 'about', 'who', 'get', 'which', 'go', 'me', 'when',
    'make', 'can', 'like', 'time', 'no', 'just', 'him', 'know',
    'take', 'people', 'into', 'year', 'your', 'good', 'some',
    'could', 'them', 'see', 'other', 'than', 'then', 'now',
    'look', 'only', 'come', 'its', 'over', 'think', 'also',
    'back', 'after', 'use', 'two', 'how', 'our', 'work', 'first',
    'well', 'way', 'even', 'new', 'want', 'because', 'any',
    'these', 'give', 'day', 'most', 'us'
  ]);

  private readonly USE_GLOBAL = 'true';

  constructor(private readonly context: Context | JobContext) {}

  // getTopWords returns the top words used in the subreddit.
  // The count parameter specifies how many words to return. If empty, current subreddit is used.
  async getTopWords(count: number = 20): Promise<{word: string, score: number}[]> {
    const source = this.USE_GLOBAL ? 'all' : await this.context.reddit.getCurrentSubreddit();
    const subredditName = source === 'all' ? 'all' : source.name;
    const wordsKey = `words:${subredditName}`;

    console.log('Fetching words from key:', wordsKey); // Debug log

    const topWords = await this.context.redis.zRange(wordsKey, 0, count - 1, { 
      by: 'rank',
      reverse: true,
    });
    
    console.log('Found words:', topWords); // Debug log

    // Convert to array and sort by word length
    const words = topWords.map(entry => ({
      word: entry.member,
      score: entry.score
    }));

    return words.sort((a, b) => a.word.length - b.word.length);
  }

  async updateWordCounts(source: string): Promise<void> {
    const posts = await this.context.reddit.getTopPosts({
      subredditName: source,
      timeframe: 'day',
      limit: 25
    });

    // Add debug logging
    console.log('Fetched posts:', posts);

    const currentPostIds = new Set<string>();
    for await (const post of posts) {
      if (post.authorName !== 'snoordle-v2') {
        currentPostIds.add(post.id);
        await this.processPost(source, post);
        console.log('Processed post:', post.id); // Debug log
      }
    }
  }

  private async processPost(subredditName: string, post: Post): Promise<void> {
    const activePostsKey = `posts:${subredditName}:active`;
    
    if (await this.context.redis.zScore(activePostsKey, post.id)) {
      return;
    } 

    const wordCounts = await this.countPostWords(post);
    
    // Store post counts
    await this.context.redis.set(
      `posts:${subredditName}:${post.id}`,
      JSON.stringify(wordCounts)
    );

    // Add to active posts
    await this.context.redis.zAdd(activePostsKey, {
      member: post.id,
      score: new Date(post.createdAt).getTime()
    });

    // Update word counts
    await this.incrementPostCounts(subredditName, wordCounts);
  }

  private async countPostWords(post: Post): Promise<Record<string, number>> {
    // Only use specific text content
    const textParts = [
      post.title || '',
      post.body || '',
    ];

    // Add comment bodies
    const comments = post.comments;
    comments.limit = 100;
    for await (const comment of comments) {
      if (comment.body) {
        textParts.push(comment.body);
      }
    }

    return this.countWords(textParts.join(' '));
  }

  private countWords(text: string): Record<string, number> {
    const cleanedText = this.cleanText(text);
    return cleanedText
      .split(/\s+/)
      .filter(word => 
        word.length > 0 && 
        !this.stopwords.has(word.toLowerCase())
      )
      .reduce((counts, word) => {
        const cleanWord = word.toLowerCase();
        counts[cleanWord] = (counts[cleanWord] || 0) + 1;
        return counts;
      }, {} as Record<string, number>);
  }

  private cleanText(text: string): string {
    return text
      .replace(/[[\].,\/#!$%\^&\*;:{}=\-_`~()]/g, '') // Remove punctuation
      .replace(/\s{2,}/g, ' ') // Remove extra spaces
      .trim();
  }

  private async incrementPostCounts(subredditName: string, counts: Record<string, number>): Promise<void> {
    const wordsKey = `words:${subredditName}`;
    for (const [word, count] of Object.entries(counts)) {
      await this.context.redis.zIncrBy(wordsKey, word, count);
    }
  }

  private async cleanupRedis(subredditName: string): Promise<void> {
    await this.context.redis.del(`words:${subredditName}`);
    
    // Use zScan to find all post keys
    const activePostsKey = `posts:${subredditName}:active`;
    const posts = await this.context.redis.zRange(activePostsKey, 0, -1);
    
    // Delete each post's data
    for (const post of posts) {
      await this.context.redis.del(`posts:${subredditName}:${post.member}`);
    }
    
    await this.context.redis.del(activePostsKey);
    await this.context.redis.del(`lastUpdate:${subredditName}`);
  }

  async refreshAllWords(): Promise<void> {
    const source = this.USE_GLOBAL ? 'all' : await this.context.reddit.getCurrentSubreddit();
    const subredditName = source === 'all' ? 'all' : source.name;
    
    await this.cleanupRedis(subredditName);
    await this.updateWordCounts(subredditName);
    
    console.log(`Refreshed words for: ${subredditName}`);
  }
}