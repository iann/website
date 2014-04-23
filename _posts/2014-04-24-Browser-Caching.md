---

title:   Browser Caching
author:  Ian Moriarty  
date:   2014-04-22

---

# Browser Caching

## Overview
Many assets on webpages are static files (Javascript, CSS, images, etc). This type of content can and should be cached. Caching saves on bandwidth and provides a better user experience. The HTTP Specification allows for caching at many levels. This arcticle will focus primarily on Request (User Agent / Client) and Response Headers (Server).

## Protocol
When a client requests an asset on a web server it sends a `GET` request to the server. Along with the `GET` request the client sends additional information about the request. The additional infomration is contined in the beginning or head of the file as such these properties are called `Headers`. The response from the server also contains Headers.

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

## Headers
The full specificaion on HTTP/1.1 caching header directives can be found here [\[1\]](http://www.w3.org/Protocols/rfc2616/rfc2616-sec14.html#sec14).

> `public` -- Indicates that the response MAY be cached by any cache, even if it would normally be non-cacheable or cacheable only within a non- shared cache.

> `private` -- Indicates that all or part of the response message is intended for a single user and MUST NOT be cached by a shared cache. This allows an origin server to state that the specified parts of the
response are intended for only one user and are not a valid response for requests by other users. A private (non-shared) cache MAY cache the response.

HTTP has many mechanisms to help speed up request to response latency through caches. Caches can be both private and public. An example of a public cache would be a Squid proxy running on a corporate network or an Internet Service Provider (ISP) caching common website assets. A private cache could be a clients local (browser) cache.

Mark Nottingham summarizes a few more directives [\[2\]](http://www.mnot.net/cache_docs/):

> `max-age` [seconds] -- specifies the maximum amount of time that a representation will be considered fresh. Similar to Expires, this directive is relative to the time of the request, rather than absolute. [seconds] is the number of seconds from the time of the request you wish the representation to be fresh for. 

`max-age` is a stong validator. Within the asset's max-age time the client _will not_ make further requests to the server until the max-age has expired. That is, the cached version of the file will be used without consulting with the server for an updated asset until the `max-age` time has elapsed.

> `s-maxage` [seconds] -- similar to max-age, except that it only applies to shared (e.g., proxy) caches.

> `no-cache` -- forces caches to submit the request to the origin server for validation before releasing a cached copy, every time. This is useful to assure that authentication is respected (in combination with public), or to maintain rigid freshness, without sacrificing all of the benefits of caching.

This directive can be sent by both the client (request) and the server (response).

When sent with the request by the client this directive instructs the upstream proxies  to _revalidate_ cached copies with the origin server. The response must not be a cached copy.

Conversely, when `no-cache` is sent with the response from the server the server is instructing the browser to _revalidate_ the asset before using a locally cached copy.

> `no-store` -- instructs caches not to keep a copy of the representation under any conditions.

`no-store` is more strict than `no-cache`. With `no-store` set all intermediate caches are instructed _not_ to store the response. This can be sent from either the client or the server.

> `must-revalidate` -- tells caches that they must obey any freshness information you give them about a representation. HTTP allows caches to serve stale representations under special conditions; by specifying this header, you’re telling the cache that you want it to strictly follow your rules.

> `proxy-revalidate` -- similar to must-revalidate, except that it only applies to proxy caches.

Mobify [\[3\]](https://www.mobify.com/blog/beginners-guide-to-http-cache-headers/) defines other common header directives:

> `expires` -- Back in the day, this was the standard way to specify when an asset expired, and is just a basic date-time stamp. It is still fairly useful for older user agents, which cryptowebologists assure us still roam in the uncharted territories. On most modern systems, the "cache-control" headers "max-age" and "s-maxage" will take precedence, but it's always good practice to set a matching value here for compatibility. 

The expires header is a strong validator. With an expires header the client _will not_ request a new asset until after the expiration date. [\[2\]](http://www.mnot.net/cache_docs/)

> The Expires header can’t be circumvented; unless the cache (either browser or proxy) runs out of room and has to delete the representations, the cached copy will be used until then.

Setting far in the future expires dates can be dangerous if the underlying asset changes. Since the client will not talk to the server until after the expiration date it will always used the locally cached copy until that point. This senario is called a poison cache and a cache busting technique (described below) must be used to break out of it. 

> `no-transform` -- “Transform into what?”, you’re surely asking. Some proxies will convert image formats and other documents to improve performance. Presumably this was thought to be a feature that you should have to opt out of. If you don’t like the idea of your CDN making automated guesses about how your content should be encoded or formatted, I suggest including this header.

> `etag` -- Short for "entity-tag", the etag is a unique identifier for the resource being requested, typically comprised of the hash of that resource, or a hash of the timestamp the resource was updated. Basically, this lets a client ask smarter questions of the CDNs, like "give me X if it's different than the etag I already have."

TODO: explain etag:


## Cachine Strategies

## Cache Busting

TODO: cite

> The most effective solution is to change any links to them; that way, completely new representations will be loaded fresh from the origin server. Remember that any page that refers to these representations will be cached as well. Because of this, it’s best to make static images and similar representations very cacheable, while keeping the HTML pages that refer to them on a tight leash.

## Resoucres

* [1] http://www.w3.org/Protocols/rfc2616/rfc2616-sec14.html#sec14
* [2] http://www.mnot.net/cache_docs/
* [3] https://www.mobify.com/blog/beginners-guide-to-http-cache-headers/
* 
* [3] https://developers.google.com/speed/docs/best-practices/caching
* https://developers.google.com/speed/articles/gzip?hl=en
* http://blog.maxcdn.com/accept-encoding-its-vary-important/
* http://blogs.msdn.com/b/ieinternals/archive/2010/07/08/technical-information-about-conditional-http-requests-and-the-refresh-button.aspx
* http://betterexplained.com/articles/how-to-optimize-your-site-with-http-caching/
* https://stackoverflow.com/questions/14345898/what-heuristics-do-browsers-use-to-cache-resources-not-explicitly-set-to-be-cach
* http://redbot.org/