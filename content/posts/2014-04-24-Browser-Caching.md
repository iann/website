---

title:   Browser Caching
author:  Ian Moriarty  
date:    2014-04-25
layout:  post

---

### Overview

Many assets on webpages are static files (Javascript, CSS, images, etc). This type of content *can* and *should* be cached. Caching saves on bandwidth and provides a better user experience. The HTTP Specification [RFC2616](http://www.w3.org/Protocols/rfc2616/rfc2616.html) allows for caching at many levels. This article will focus primarily on requests made by user-agents / clients and corresponding responses from origin servers.

<!--more-->

### Protocol

When a client requests an asset on a web server it sends a `GET` request to the server. Along with the `GET` request the client sends additional information about the request. The additional information is contained in the beginning or head of the file accordingly these properties are called `Headers`. The corresponding response from the server also contains Headers.  Headers specify what a client is capable of accepting or server is sending in the payload and provide other directives.

Here's an example of a request headers:

```
Accept: text/css,*/*;q=0.1
Accept-Encoding: gzip, deflate, compress
Cache-Control: no-cache
User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_9_2) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/36.0.1942.0 Safari/537.36
```

And the corresponding response headers:

```
Connection: keep-alive
Content-Encoding: gzip
Content-Length: 1375
Content-Type: text/css
Date: Wed, 16 Apr 2014 18:01:40 GMT
Last-Modified: Wed, 09 Apr 2014 20:15:56 GMT
Server: Apache-Coyote/1.1
Vary: Accept-Encoding
```

### Cache Headers

The full specification on HTTP/1.1 caching header directives can be found here [\[1\]](http://www.w3.org/Protocols/rfc2616/rfc2616-sec14.html#sec14).

> `public` -- Indicates that the response MAY be cached by any cache, even if it would normally be non-cacheable or cacheable only within a non-shared cache.

In some versions of Firefox if public is not set on HTTPS traffic no disk caching will take place [\[2\]](https://developers.google.com/speed/docs/best-practices/caching).

> `private` -- Indicates that all or part of the response message is intended for a single user and MUST NOT be cached by a shared cache. This allows an origin server to state that the specified parts of the
response are intended for only one user and are not a valid response for requests by other users. A private (non-shared) cache MAY cache the response.

HTTP has many mechanisms to help speed up request to response latency through caches. Caches can be both private and public. An example of a public cache would be a Squid proxy running on a corporate network or an Internet Service Provider (ISP) caching common website assets. A private cache could be a clients local (browser) cache.

Mark Nottingham summarizes a few more caching directives [\[3\]](http://www.mnot.net/cache_docs/):

> `max-age` [seconds] -- specifies the maximum amount of time that a representation will be considered fresh. Similar to Expires, this directive is relative to the time of the request, rather than absolute. [seconds] is the number of seconds from the time of the request you wish the representation to be fresh for.

`max-age` is a strong validator. Within the asset's max-age time the client **will not** make further requests to the server until the max-age has expired. That is, the cached version of the file **will** be used without consulting with the server for an updated asset until the `max-age` time has elapsed.

> `s-maxage` [seconds] -- similar to max-age, except that it only applies to shared (e.g., proxy) caches.

> `no-cache` -- forces caches to submit the request to the origin server for validation before releasing a cached copy, every time. This is useful to assure that authentication is respected (in combination with public), or to maintain rigid freshness, without sacrificing all of the benefits of caching.

This directive can be sent by both the client (request) and the server (response).

When sent with the request by the client this directive instructs the upstream proxies to *revalidate* cached copies with the origin server. The response must not be a cached copy.

Conversely, when `no-cache` is sent with the response from the server the server is instructing the browser to **revalidate** the asset before using a locally cached copy.

> `no-store` -- instructs caches not to keep a copy of the representation under any conditions.

`no-store` is more strict than `no-cache`. With `no-store` set all intermediate caches are instructed *not* to store the response. This can be sent from either the client or the server.

> `must-revalidate` -- tells caches that they must obey any freshness information you give them about a representation. HTTP allows caches to serve stale representations under special conditions; by specifying this header, you’re telling the cache that you want it to strictly follow your rules.

> `proxy-revalidate` -- similar to must-revalidate, except that it only applies to proxy caches.

Mobify [\[4\]](https://www.mobify.com/blog/beginners-guide-to-http-cache-headers/) defines other common header directives:

> `expires` -- Back in the day, this was the standard way to specify when an asset expired, and is just a basic date-time stamp. It is still fairly useful for older user agents, which cryptowebologists assure us still roam in the uncharted territories. On most modern systems, the "cache-control" headers "max-age" and "s-maxage" will take precedence, but it's always good practice to set a matching value here for compatibility.

The expires header is a strong validator. With an expires header the client **will not** request a new asset until after the expiration date. [\[2\]](http://www.mnot.net/cache_docs/)

> The Expires header can’t be circumvented; unless the cache (either browser or proxy) runs out of room and has to delete the representations, the cached copy will be used until then.

Setting far in the future expires dates can be dangerous if the underlying asset changes. Since the client will not talk to the server until after the expiration date it will always used the locally cached copy until that point. When a page breaks due to incorrect caching policies it is called a poison cache scenario and a cache busting technique (described below) must be used to break out of it.

> `no-transform` -- “Transform into what?”, you’re surely asking. Some proxies will convert image formats and other documents to improve performance. Presumably this was thought to be a feature that you should have to opt out of. If you don’t like the idea of your CDN making automated guesses about how your content should be encoded or formatted, I suggest including this header.

> `etag` -- Short for "entity-tag", the etag is a unique identifier for the resource being requested, typically comprised of the hash of that resource, or a hash of the timestamp the resource was updated. Basically, this lets a client ask smarter questions of the CDNs, like "give me X if it's different than the etag I already have."

An `etag` is a file validator and a weak caching header. If a cached object is not due to be refreshed from the server it will make no difference if the etags do not match. An `etag` should be used in addition to other caching headers.

> `last-modified` -- This header defines the last time the file was modified. This normally corresponds to the asset's timestamp. Many servers include this header in a response and the client uses this as a file validator and weak cache header.

Similar to `etag`, `last-modified` is a file validator and should be used with other caching headers.

`etag` and `last-modified` can be used to save on bandwidth. When a cache expires the browser will make a new `GET` request for that asset. If the asset has an `etag` or `last-modified` it will send `if-none-match` or `if-modified-since` headers with the request, respectively. If the `etag` has not changed or the modification date is less than or equal to the cached asset the server will respond with `304 Not Modified` with no content in the body. Presumably, a server will respond with `max-age` or a new `expires` date and the client will not request again until that time has elapsed.

### Caching Strategies

There are three general strategies when it comes to caching.  I have dubbed these *sometimes*, *always* and *never*.

#### Sometimes

The other strategy is to have a continuous caching strategy. One does not want to completely eliminate the benefits of caching but files are updated often enough that assets can not be stale long amounts of time. These variables can be tweaked but here is an example Amazon S3 uses for static assets.

```
Cache-Control: no-transform,public,max-age=300,s-maxage=900
Date: Wed, 23 Apr 2014 20:53:12 GMT
Etag: "bbea5db7e1785119a7f94fdd504c546e"
Last-Modified: Thu, 17 Apr 2014 22:33:18 GMT
Server: AmazonS3
Vary: Accept-Encoding
```

We can see that S3 tells intermediate caches to hold onto content for 900 seconds while clients should keep content for 300 seconds. The average active session can be another useful value for cache time. It is important to have either an `etag` or `last-modified` set because we can benefit from a `304 Not Modified` response when the cached file expires.

#### Always

Google recommends the "always" technique to ensure maximum caching and clients always getting the most fresh files. In this technique one sets their cache to as long as possible (maximum 1 year) to ensure the most efficient caching takes place. If a file change takes place the client is forced to download the latest file, this is done by dynamically changing the name of the file based on its contents. This step ideally would be automated in a build step.

Example cache headers would be:

```
Cache-Control: public, max-age=31536000
Date: Wed, 23 Apr 2014 20:53:12 GMT
Expires: Thu, 23 Apr 2015 20:53:12 GMT
Last-Modified: Wed, 09 Oct 2013 01:35:39 GMT
```

#### Never

This strategy is useful if the asset should never be kept in local or intermediate caches.

```
Cache-Control: private, max-age=0, no-cache, no-store
Pragma: no-cache
Date: Wed, 23 Apr 2014 20:53:12 GMT
Expires: Wed, 23 Apr 2014 20:53:12 GMT
```

Of course, if the traffic is over HTTPS intermediate caches can not cache assets.

### Cache Busting

> The most effective solution is to change any links to them; that way, completely new representations will be loaded fresh from the origin server. Remember that any page that refers to these representations will be cached as well. Because of this, it’s best to make static images and similar representations very cacheable, while keeping the HTML pages that refer to them on a tight leash. [\[2\]](http://www.mnot.net/cache_docs/)

### Interesting Edge Cases

A place to keep an ongoing log of interesting cacheing strategies. Use [REDbot](http://redbot.org/) on a URL to see possible caching pitfalls.

#### Browser Caching Heuristic

According to the spec, when a server sends partial caching headers then the client has to decide the correct caching strategy [\[5\]](http://www.w3.org/Protocols/rfc2616/rfc2616-sec13.html). An example is when no `expires` or `cache-control` headers are set, but file validation `last-modified` or `etag` are sent. The client will apply a heuristic expiration to the asset.

Firefox and Chrome currently implement the following heuristic.

```c
if (last_modified_value <= date_value) {
    return (date_value - last_modified_value) / 10;}
```

Where `last_modified_value` is the `last-modified` header and `date_value` is the date returned in the response header or the clients current date-time. The calculated value is then set to that assets `max-age`. A quick calculation will show why this is not always a good idea. Let's say we have an asset last modified 200 days ago. Chrome and Firefox will set the expiration of this file to 20 days into the future. This expiration time gets longer and longer if the files do not change often.

### Resources

* [1] http://www.w3.org/Protocols/rfc2616/rfc2616-sec14.html#sec14
* [2] https://developers.google.com/speed/docs/best-practices/caching
* [3] http://www.mnot.net/cache_docs/
* [4] https://www.mobify.com/blog/beginners-guide-to-http-cache-headers/
* [5] http://www.w3.org/Protocols/rfc2616/rfc2616-sec13.html

### Additional Reading

* https://developers.google.com/speed/articles/gzip?hl=en
* http://blog.maxcdn.com/accept-encoding-its-vary-important/
* http://blogs.msdn.com/b/ieinternals/archive/2010/07/08/technical-information-about-conditional-http-requests-and-the-refresh-button.aspx
* http://betterexplained.com/articles/how-to-optimize-your-site-with-http-caching/
* https://stackoverflow.com/questions/14345898/what-heuristics-do-browsers-use-to-cache-resources-not-explicitly-set-to-be-cach
