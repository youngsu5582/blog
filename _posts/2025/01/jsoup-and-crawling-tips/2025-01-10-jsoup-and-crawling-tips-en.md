---
title: "Jsoup and Crawling Tips"
author: 이영수
date: 2025-01-10T03:09:17.486Z
tags: ['Jsoup', 'Selenium', 'Wooteco', 'Crawling']
categories: ['Backend', 'Java']
description: "Isn't crawling done with Selenium?"
image:
  path: https://velog.velcdn.com/images/dragonsu/post/30e328a0-b078-4a23-be27-e540dad04d62/image.png
permalink: /posts/jsoup-and-crawling-tips
lang: en
permalink: /posts/jsoup-and-crawling-tips/
---

> This post has been translated from Korean to English by Gemini CLI.

Recently, I had to do some crawling work.
However, I was curious because I was using a library called `Jsoup` instead of `Selenium`.
This is because I used Selenium every time I made Bitcoin trading bots, course registration macros, etc.

# Jsoup

https://github.com/jhy/jsoup

Jsoup is a library that allows you to work with HTML and XML.
It provides DOM-related APIs and allows selection using CSS and XPath.

## VS Selenium

Jsoup makes HTTP requests to fetch data.
That is, it can only work with static HTML data received from the server.

Modern websites use Client-Side Rendering (CSR) when users request content from the server for fast responsiveness.
1. The server only sends data to the browser.
2. The browser renders the screen with this data.

Due to the dynamic nature of CSR, where the browser draws the screen, if you use HTTP Request to request data from the server, you cannot collect the data drawn on the actual screen.
 
Selenium can collect dynamic data using WebDriver.

### WebDriver

It is an automation interface designed to programmatically control browsers.
(Directly opening, closing, clicking, network events, etc.)

- Each browser has its own Driver.
- The browser version must match the version existing on the computer.

### Trying it out

I just tried to measure performance, but it went through a very annoying process. After installing, it wasn't recognized, and since it's a MacBook, I specified the application, but it didn't work, etc., etc...
(Isn't this also a disadvantage of Selenium...?)

```java
WebDriverManager.chromedriver().setup();  
final WebDriver driver = new ChromeDriver();  

try {  
	driver.get("https://www.google.com/");  
} finally {  
	driver.quit();  
}
```

It can be difficult to match the version of Google Chrome installed.
(Because the Driver is not provided, or version updates occur)
-> Therefore, I used the `'io.github.bonigarcia:webdrivermanager:5.5.3'` dependency that automatically matches the version.

It checks if the version exists, and if not, it automatically downloads + specifies the path.
(Prevents repetitive downloads through local cache)

This part also takes unnecessary time.

```java
Setup Time Taken: 347ms
```

If you simply send a request to `https://www.google.com/`?

```java
...
Document document = Jsoup.connect(url).get();
driver.get(url);
...        
```

```java
Jsoup Time Taken: 795ms

Selenium Time Taken: 1649ms
```

As such, there is a time difference.
`+` Since Chrome is executed, more CPU and memory are consumed. (About 3MB occurred when checking)

### Conclusion

I think Selenium is generally unnecessary.
(Because there is a performance difference in terms of time + resources)

If what you need to crawl is:
- Does it require step-by-step operations (logging in, what interactions to perform...)
- Does it require dynamic data, not static data?

If not, let's use static crawling.

---

Now I will summarize simple ways and tips for using Jsoup and conclude.
It provides a surprisingly good [CookBook](https://jsoup.org/cookbook/), so if you just read this part, you will be able to work very comfortably.

## Getting Document

```java
Jsoup.connect(url)
```

Creates a Connection to connect via URL.

```java
public interface Connection {
	...
}
```

It enables all HTTP elements we commonly know, such as `Timeout`, `Header`, and `Cookie`.

```java
@Override  
public Document get() throws IOException {  
    req.method(Method.GET);  
    execute();  
    Validate.notNull(res);  
    return res.parse();  
}
```

As such, calling the method sends a request and receives a `Document`.

If already fetched?

```java
String html = "<html><head><title>Example</title></head><body><p>Hello, World!</p></body></html>";
Document document = Jsoup.parse(html);
```

You can use `Jsoup.parse`.

## select

[Example URL](https://riverstone.co.kr/product/etro-%EC%97%90%ED%8A%B8%EB%A1%9C-%EC%9A%B8-%EB%B8%94%EB%A0%88%EC%9D%B4%EC%A0%80-%ED%8C%AC%EC%B8%A0-%EC%84%B8%ED%8A%B8-size-women-free-made-in-italy/87657/category/1/display/2/)

What if there is an example like this?

If you go through the developer tools, the `Elements` part is what we can use.
(Of course, you need to check if they are dynamic elements created through CSR.)

```java
document.html()
```

Can be checked through.

Jsoup provides CSS Selector, so you can use it to extract DOM elements very conveniently.

- Basic selectors (`tag`, `.class`, `#id`)
- Hierarchical selectors
- Attribute selectors
- State selectors (elements supported by Jsoup) - `div:contains(Hello)`

> There is a common mistake in hierarchical selectors:
>- `ancestor descendant`: Selects all descendants of a specific ancestor.
>- `parent > child`: Selects immediate children of a specific parent.
> You need to be careful about the difference between these two.

HTML documents are represented in a tree structure. (Each tag is converted to a node in the tree)

```java
public static Elements select(Evaluator evaluator, Element root) {  
    return Collector.collect(evaluator, root);  
}

public static Elements collect (Evaluator eval, Element root) {  
    eval.reset();  
  
    return root.stream()  
        .filter(eval.asPredicate(root))  
        .collect(Collectors.toCollection(Elements::new));  
}

public Predicate<Element> asPredicate(Element root) {  
    return element -> matches(root, element);  
}

// This is an implementation (different for each element)

public boolean matches(Element root, Element element) {  
    return element.hasAttr(key) && value.equalsIgnoreCase(element.attr(key).trim());  
}
```

- If there is `<meta property="product:sale_price:amount" content="84000">`?

```java
var element = document.selectFirst("meta[property='product:sale_price:amount']")  
return element.attr("content") // 84000
```

It finds `meta property` and extracts its internal elements.

```java
var elements = document.select("div.xans-product-additional #prdDetail img")
```

It extracts only `img`s among all descendants of the element with `prdDetail` ID, which has the `xans-product-additional` class in `div`.

## Simple Tips

### Keep it as simple as possible

![500](https://i.imgur.com/GPsNZuh.png)

[Sample Link](https://riverstone.co.kr/product/indivi-%EC%95%99%EA%B3%A0%EB%9D%BC-%EC%9A%B8-%EC%9E%90%EC%BC%93-%EC%97%AC-l/87479/category/25/display/1/)

If you copy the Selector because you need details from this link?
-> `#infoArea_fixed > div.xans-element-.xans-product.xans-product-detaildesign > table` appears.

`document.select("#infoArea_fixed > div.xans-element-.xans-product.xans-product-detaildesign > table > tbody")`

It can be fetched through this, but `.xans-product > table > tbody` is also possible.
What is the performance difference between the two?

```java
public static void main(final String[] args) {  
  
        TimeUtil.measureExecutionTime("jsoup deep", () -> {  
            final var baseUrl = "https://riverstone.co.kr";  
            final var document = getDocument("https://riverstone.co.kr/category/women/25/?page=3");  
  
            final var documents = parseDocument(document, "ul.prdList a")  
                    .stream()  
                    .map(element -> element.attr("href"))  
                    .map(url -> getDocument(url, baseUrl))  
                    .toList();  
  
            final var result1 = findFirst(documents);  
//            final var result2 = findSecond(documents);  
        });  
}

private static List<String> findFirst(final List<Document> documents) {  
    return documents.stream()  
            .map(document -> document.select(".xans-product > table > tbody"))  
            .map(element -> Optional.ofNullable(element)  
                    .map(Elements::text)  
                    .orElse(""))  
            .toList();  
}  
  
private static List<String> findSecond(final List<Document> documents) {  
    return documents.stream()  
            .map(document -> document.select("#infoArea_fixed > div.xans-element-.xans-product.xans-product-detaildesign > table > tbody"))  
            .map(element -> Optional.ofNullable(element)  
                    .map(Elements::text)  
                    .orElse(""))  
            .toList();  
}
```

I intentionally fetched it through pagination to avoid caching and additional elements.

```java  
// .xans-product > table > tbody - 51291ms  
// #infoArea_fixed > div.xans-element-.xans-product.xans-product-detaildesign > table > tbody - 50122ms
```

Surprisingly, there is no significant difference.
This is due to the DOM tree traversal method. This content does not cover it in detail. (Part outside the topic)
It would be good to refer to [Modern JavaScript Document](https://ko.javascript.info/document) for more information.

- DOM is a tree-like hierarchy, and elements can be moved up and down the hierarchy to find them. - No need to search irrelevant parts.
- Optimized to quickly find elements based on unique IDs - expected O(1) similar to HashMap.
- The browser automatically corrects incorrect `html` to efficiently handle DOM traversal and manipulation.

Based on these elements, there is no time difference.

Nevertheless, you should only apply the necessary elements for crawling.
The more detailed it is, the more sensitive it becomes to changes.

- If `#infoArea_fixed` changes to `#infoArea`?
-> That crawling needs to be changed.

- If `xans-product-detaildesign` in `div.xans-element-.xans-product.xans-product-detaildesign` is no longer needed?
-> That crawling needs to be changed.

Instead of using the `Selector` automatically provided by the browser, let's directly search and configure only the necessary elements.

> In particular, if you simply `Copy Selector`,
> you might get all selectors of elements like `#prdDetail > div > div > div > div > div > img:nth-child(1)`.
> At this time, `div > ... > div` may not be necessary.
> Anyway, the core is to get `img`s within `#prdDetail`.

### Immutability

[Sample Link](https://deadstock.co.kr/product/adidas-%EC%95%84%EB%94%94%EB%8B%A4%EC%8A%A4-%ED%8F%B4%EB%A6%AC%EC%97%90%EC%8A%A4%ED%84%B0-100-%ED%8A%B8%EB%A0%88%EC%9D%B4%EB%8B%9D-%ED%8C%AC%EC%B8%A0-%EC%97%AC-l/450317/category/775/display/1/)

![500](https://i.imgur.com/hRD0ThX.png)

If you try to get a thumbnail image?

It gets it as `#prdDetail > img:nth-child(1)`.

`nth-child` is a very variable element. This is because it means `the nth child of img`.
This is also affected if the DOM structure changes or web developers change the image order.

Most commercial websites provide various elements for search engine optimization.

![500](https://i.imgur.com/WAfiY5x.png)

- description, keywords, author
- og:title, og:type, og:url (Open Graph Protocol)
- naver, google site verification

If you search through `meta` or look at the `head` section, you will find a wide variety of information.
What about the thumbnail we want to use? The same image is also provided through `og:image`.

`What is extracted from the body content` is more immutable and always provided than `what is provided for search engines`.

In the same context, judging how sensitive the part you are currently crawling is to changes, or whether it will be provided fixedly, will also be a very good factor.

### Obvious robots

It's obvious, but always check `robots.txt` carefully.
It provides guidelines to web crawlers to allow or block access to specific parts.

- Blocking specific crawlers (`User-Agent`) - GitHub throws `4xx` if a request is sent with an empty User-Agent.
- Blocking access to specific paths - `/admin, /api`
- SEO not needing unnecessary access

It consists of these elements.

In particular, indiscriminately crawling unauthorized elements for commercial use can lead to punishment.
[### Criminal is innocent, civil is "1 billion won compensation"... How far can data crawling go?](https://www.hani.co.kr/arti/society/society_general/1061963.html)
(Famous legal battle over crawling between Yanolja vs. Yeogieottae)

### Functionalization

This is a minor tip rather than crawling, but:

```kotlin
@Component  
class ThumbnailImageInMeta : ThumbnailImage {  
  
    override fun parseFrom(document: Document, domain: String): String {  
        val element = document.selectFirst("meta[property='og:image']")  
        return element?.attr("content")?:throw IllegalStateException("Not Exist ThumbnailImage In Meta")  
    }
}
```

If used frequently, make it an `@Component` and inject it for use.
This depends on the nature of the element to be crawled, but if it has a similar pattern, declare it and inject it to prevent code duplication.

Anyway, crawling is often separated from the existing server + often done at a fixed time or regularly.
(It is not greatly affected by memory or performance.)

```kotlin
private val crawler = Crawler(  
    ThumbnailImageInMeta(),
)
```

What about unit testing like this?
-> You can just create it, so it doesn't matter if you break away from Spring dependency.

Of course, don't rush to abstract and generalize the code, but introduce it if it's appropriate.

```kotlin
abstract class Cafe24Crawler(
	...
)
class SampleCrawler():Cafe24Crawler
```

Reducing code duplication is also possible with `abstract class` : `implementation class` like this.

## Conclusion

Crawling can be implemented as quickly and easily as possible.

However,

- Not sensitive to changes in crawling
- Not sensitive to changes in code

Let's create crawling by considering these two well.
