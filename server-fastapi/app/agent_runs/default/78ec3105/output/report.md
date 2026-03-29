# Redis: A Comprehensive Overview

## What is Redis?

**Redis** (Remote Dictionary Server) is an open-source, in-memory data structure store that can be used as a database, cache, message broker, and streaming engine. Created by Salvatore Sanfilippo in 2009, Redis has become one of the most popular NoSQL databases due to its exceptional speed and versatility.

## Key Features

### 1. In-Memory Storage
- Data is stored in RAM for sub-millisecond response times
- Optional persistence to disk (RDB snapshots, AOF logs)
- Typical read/write operations: ~100,000+ ops/second

### 2. Rich Data Structures
Redis supports multiple data types beyond simple key-value:

| Data Type | Description | Use Cases |
|-----------|-------------|-----------|
| **Strings** | Binary-safe strings up to 512MB | Caching, counters, sessions |
| **Lists** | Ordered collections of strings | Queues, timelines, logs |
| **Sets** | Unordered unique string collections | Tags, unique visitors |
| **Sorted Sets** | Sets with score-based ordering | Leaderboards, rate limiting |
| **Hashes** | Field-value pair collections | Objects, user profiles |
| **Streams** | Append-only log structures | Event sourcing, messaging |
| **HyperLogLog** | Probabilistic cardinality counting | Unique count estimates |
| **Bitmaps** | Bit-level operations on strings | Feature flags, analytics |
| **Geospatial** | Location-based indexing | Proximity searches |

### 3. Persistence Options
- **RDB (Redis Database)**: Point-in-time snapshots at intervals
- **AOF (Append Only File)**: Logs every write operation
- **Hybrid**: Combines both for durability + fast restarts

### 4. High Availability
- **Replication**: Master-replica architecture
- **Redis Sentinel**: Automatic failover and monitoring
- **Redis Cluster**: Horizontal scaling with automatic sharding

## Common Use Cases

### Caching
```
SET user:1001:profile "{name: 'John', email: 'john@example.com'}" EX 3600
GET user:1001:profile
```

### Session Storage
Fast read/write for web application sessions with automatic expiration.

### Real-time Leaderboards
```
ZADD game:leaderboard 1500 "player1" 2300 "player2" 1800 "player3"
ZREVRANGE game:leaderboard 0 9 WITHSCORES
```

### Rate Limiting
```
INCR api:user:1001:requests
EXPIRE api:user:1001:requests 60
```

### Pub/Sub Messaging
```
SUBSCRIBE notifications
PUBLISH notifications "New message received"
```

### Message Queues
Using Lists as queues with LPUSH/BRPOP for reliable job processing.

## Performance Characteristics

| Metric | Typical Value |
|--------|---------------|
| Read latency | < 1ms |
| Write latency | < 1ms |
| Throughput | 100K-500K ops/sec (single instance) |
| Max key size | 512MB |
| Max keys | ~2^32 per database |

## Redis vs Other Databases

| Feature | Redis | Memcached | MongoDB |
|---------|-------|-----------|---------|
| Data structures | Rich | Key-value only | Documents |
| Persistence | Yes | No | Yes |
| Clustering | Yes | Client-side | Yes |
| Transactions | Yes (MULTI) | No | Yes |
| Memory efficiency | Moderate | High | N/A |

## Getting Started

### Installation
```bash
# Ubuntu/Debian
sudo apt-get install redis-server

# macOS
brew install redis

# Docker
docker run -p 6379:6379 redis
```

### Basic Commands
```bash
redis-cli

# String operations
SET mykey "Hello"
GET mykey

# List operations
LPUSH mylist "world"
LPUSH mylist "hello"
LRANGE mylist 0 -1

# Check keys
KEYS *
TTL mykey
```

## Best Practices

1. **Set memory limits**: Configure `maxmemory` and eviction policies
2. **Use appropriate data structures**: Choose the right type for your use case
3. **Enable persistence** for durability requirements
4. **Monitor memory usage**: Redis can consume significant RAM
5. **Use connection pooling**: Reduce connection overhead
6. **Set key expiration**: Prevent memory bloat with TTLs
7. **Avoid large keys**: Keep values reasonably sized

## Conclusion

Redis excels as a high-performance, versatile data store for caching, real-time applications, and scenarios requiring sub-millisecond latency. Its rich data structures, persistence options, and clustering capabilities make it suitable for a wide range of use cases from simple caching to complex real-time systems.

---
*Report generated for Redis overview*
