

# Tacoma Web Design and SEO

  
## Web Design Starter Template
 

This template is used for the starting of all web design projects for Tacoma Web Design and SEO. Further documentation can be found internally and through this README https://github.com/CodeStitchOfficial/Intermediate-Website-Kit-SASS.

## Optimization Changes

All of this optimization are enabled by default to make the development smooth and allows developer to focus on building the site while the optimization already taken care of. The Auto Image Optimization require some efforts for the developer to be used correctly which is explain below, then other optimization should already be good to go.

- [Auto Image Optimization](#auto-image-optimization)
- [Auto Generate Critical CSS](#auto-generate-critical-css)
- [Auto Sitemap and Robots Generator](#auto-sitemap-and-robots-generator)
- [CSS and JS Minify](#css-and-js-minify)
- [CSS Auto Prefixer](#css-auto-prefixer)
- [Netlify Plugin Cache](#netlify-plugin-cache)
- [Local HTML Validation](#local-html-validation)
- [Local Link Check](#local-link-check)

### Auto Image Optimization

This is the part that automates resizing, compressing and converting the images.
A good practice when having image on the website is having a different image size for different screen size.
We want to
1. Resize the images twice or at least 1.5x the render size so no pixel is wasted while still being crisp
2. then we compress the image to lower more the file size.
3. Finally we convert it to web format images like webp, avif etc which lower the file size more as its optimize for web.

  

More detailed explanation [here](https://codestitch.app/page-speed-handbook#section1)

Good news we don't need to do those 3 steps anymore as this is already automated for us.
We use codestitch-sharp-image-automatione to do this for us, and by default we already enable this for this repo.

### How it works:

It works by having the image src as

    {% getUrl "/assets/images/image.jpg" | resize({ height: 500, width: 500 }) | avif %}


**Example**:

    <picture>
	    <!--Mobile Image-->
	    <source  media='(max-width: 600px)'  srcset="{% getUrl '/assets/images/home-hero-bg.jpg' | resize({ width: 530, height: 550 }) | avif %}"  type="image/avif">
	    <source  media='(max-width: 600px)'  srcset="{% getUrl '/assets/images/home-hero-bg.jpg' | resize({ width: 530, height: 550 }) | webp %}"  type="image/webp">
	    <source  media='(max-width: 600px)'  srcset="{% getUrl '/assets/images/home-hero-bg.jpg' | resize({ width: 530, height: 550 }) | jpeg %}"  type="image/jpeg">
	    <!--Desktop Image-->
	    <source  media='(min-width: 601px)'  srcset="{% getUrl '/assets/images/home-hero-bg.jpg' | resize({ width: 1054, height: 1100 }) | avif %}"  type="image/avif">
	    <source  media='(min-width: 601px)'  srcset="{% getUrl '/assets/images/home-hero-bg.jpg' | resize({ width: 1054, height: 1100 }) | webp %}"  type="image/webp">
	    <source  media='(min-width: 601px)'  srcset="{% getUrl '/assets/images/home-hero-bg.jpg' | resize({ width: 1054, height: 1100 }) | jpeg %}"  type="image/jpeg">
	    <img  src="{% getUrl '/assets/images/home-hero-bg.jpg' | resize({ width: 1054, height: 1100 }) | jpeg %}"  alt=""  width=""  height=""  loading="lazy"  decoding="async"  aria-hidden="true">
    </picture>

the above code will output:

![sample-output](https://i.ibb.co/hFqf9d4S/picture-output.png)

## VSCode Snippet

For VSCode users, we've created a snippet that can help streamline your workflow when using the plugin:

```
		"eleventy-plugin-sharp-images Snippit": {
		  "prefix": "respimg",
		  "body": [
		    "<picture class=\"${1}\">",
		    "   <!--Mobile Image-->",
		    "   <source media='(max-width: 600px)' srcset=\"{% getUrl '${2:/assets/images/placeholder.jpg}' | resize({ width: ${3}, height: ${4} }) | avif %}\" type=\"image/avif\">",
		    "   <source media='(max-width: 600px)' srcset=\"{% getUrl '${2:/assets/images/placeholder.jpg}' | resize({ width: ${3}, height: ${4} }) | webp %}\" type=\"image/webp\">",
		    "   <source media='(max-width: 600px)' srcset=\"{% getUrl '${2:/assets/images/placeholder.jpg}' | resize({ width: ${3}, height: ${4} }) | jpeg %}\" type=\"image/jpeg\">",
		    "   <!--Tablet Image-->",
		    "   <source media='(max-width: 1024px)' srcset=\"{% getUrl '${2:/assets/images/placeholder.jpg}' | resize({ width: ${5}, height: ${6} }) | avif %}\" type=\"image/avif\">",
		    "   <source media='(max-width: 1024px)' srcset=\"{% getUrl '${2:/assets/images/placeholder.jpg}' | resize({ width: ${5}, height: ${6} }) | webp %}\" type=\"image/webp\">",
		    "   <source media='(max-width: 1024px)' srcset=\"{% getUrl '${2:/assets/images/placeholder.jpg}' | resize({ width: ${5}, height: ${6} }) | jpeg %}\" type=\"image/jpeg\">",
		    "   <!--Desktop Image-->",
		    "   <source media='(min-width: 1024px)' srcset=\"{% getUrl '${2:/assets/images/placeholder.jpg}' | resize({ width: ${7}, height: ${8} }) | avif %}\" type=\"image/avif\">",
		    "   <source media='(min-width: 1024px)' srcset=\"{% getUrl '${2:/assets/images/placeholder.jpg}' | resize({ width: ${7}, height: ${8} }) | webp %}\" type=\"image/webp\">",
		    "   <source media='(min-width: 1024px)' srcset=\"{% getUrl '${2:/assets/images/placeholder.jpg}' | resize({ width: ${7}, height: ${8} }) | jpeg %}\" type=\"image/jpeg\">",
		    "   <img src=\"{% getUrl '${2:/assets/images/placeholder.jpg}' | resize({ width: ${7}, height: ${8} }) | jpeg %}\" alt=\"${9}\" width=\"${10}\" height=\"${11}\" loading=\"${12:lazy}\" decoding=\"async\" ${13:aria-hidden=\"true\"}>",
		    "</picture>"
		  ],
		  "description": "eleventy-plugin-sharp-images Snippit"
		}
```

Simply, place this into your snippets file for the HTML language in VSCode. More information on installing and using the snippet can be found within the appropriate section on the [YouTube tutorial video](https://youtu.be/scYFC1LRfPg?si=pMuDRu3FbiCNq8Ac&t=1532).

<a href="#how-it-works"></a>

## How It Works

To support environments where async features aren't allowed (like processing an image in a Nunjucks Macro), the shortcode doesn't directly generate the image. Instead, it creates a comment with a JSON configuration object. At the end of an Eleventy build, a Transform uses a regex to find all instances of these comments and process the images.

The configuration is hashed, and the file is renamed to include this hash. If an image path or its transformations change, the hash/filename will change, invalidating the cache. This works with netlify-plugin-cache to prevent reprocessing between builds in a live environment.


More details about the plugin [here](https://github.com/CodeStitchOfficial/eleventy-plugin-sharp-images)


### Auto Generate Critical CSS

Sometimes when you have a large CSS file, it can render block the page and throw up a warning in the Page Speed Insights test, resulting in a hit to your score. Almost always only fraction of the whole style is used when loading above the fold and we only need to load that as fast as possible to avoid render block and layout shifts. Above the fold means the visible part of a webpage before the user scrolls down. One way to solve this is creating a Critical CSS that containing only the style needed to load the above the fold, then deferring the remaining style. This requires transferring all the css needed and sometimes we might miss something.

**How it works:**

Auto Generate Critical CSS plugin will automate getting those CSS above the fold for us, minifying that style and add it in html as internal style. This way we can focus on developing our site while having an optimization taken care for us.


### Auto Sitemap and Robots Generator

We update sitemap and robots to tell how we want our site to be crawled by web crawler also for SEO and this is different on every site. And we should always update it every time we make changes on the site.


**How it works:**

This plugin will update the sitemap base on the client.json domain value, pages created and update the dates base on the current date the page was updated. This way we don't need to worry updating it every time we create a page or have some changes in a site. Also in most cases we always want the home page to have the highest priority which can be updated like this.

![priority](https://i.ibb.co/BfP6QFq/screen.png)

The rest of the page we can set it to 0.80

  

Auto Robots we updated it to make it dynamic base on the client.json domain value.

  

### CSS and JS Minify

This is use remove all unnecessary characters from source code without changing its functionality. This reduces their size, improve load times, and enhance performance. We can save up to 60% of the overall file size.

  
### CSS Auto Prefixer

**How it works:**

It auto add any css property that ensure compatibility across different browser and their version

**sample:**

```css
-webkit-user-select: none;
-moz-user-select: none;
-ms-user-select: none;
user-select: none;
```

### Netlify Plugin Cache

A generic cache plugin for saving and restoring files and/or folders between Netlify builds for impressive speed improvements. This is to save build minutes in netlify

  

### Local HTML Validation

HTML doesn't really give errors when we have invalid HTML or not using best practice which is bad for SEO if we have that., we use this to check the all our HTML after build to ensure we catch those before the site is live.

**How it works**

`npm run validate` - run this to validate html before deploying.
`build-and-validate` - use this if no build files yet.
  

### Local Link Check

We don't want to have invalid links in our site as it will make our site look broken. We can check our links here https://www.drlinkcheck.com/ or you can run the below command for quick checking or if you run out of link check credits in www.drlinkcheck.com/.

**How it works**
First you need to have the local running, if you haven't just run the command `npm run start`.
By default it should run in http://localhost:8080

`npm run check-links` - run this to start checking the site for every link

now you might encounter invalid link like https://www.domainname.com/contact-us/
this is fine as this is still in localhost. Other than that you should fix it before pushing your changes.
