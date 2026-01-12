module Jekyll
  class ArticlesCategoryPage < Page
    def initialize(site, base, dir, category, docs)
      @site = site
      @base = base
      @dir  = dir
      @name = "index.html"

      process(@name)
      read_yaml(File.join(base, "_layouts"), "category.html")

      self.data["title"] = category
      self.data["category"] = category
      self.data["posts"] = docs
      self.data["collection"] = "articles"
      self.data["layout"] = "category"
      self.data["permalink"] = File.join("/", dir, "/")
    end
  end

  class ArticlesTagPage < Page
    def initialize(site, base, dir, tag, docs)
      @site = site
      @base = base
      @dir  = dir
      @name = "index.html"

      process(@name)
      read_yaml(File.join(base, "_layouts"), "tag.html")

      self.data["title"] = tag
      self.data["tag"] = tag
      self.data["posts"] = docs
      self.data["collection"] = "articles"
      self.data["layout"] = "tag"
      self.data["permalink"] = File.join("/", dir, "/")
    end
  end

  class ArticlesTaxonomyGenerator < Generator
    safe true
    priority :low

    def generate(site)
      articles = site.collections["articles"]&.docs || []
      return if articles.empty?

      generate_categories(site, articles)
      generate_tags(site, articles)
    end

    private

    def generate_categories(site, docs)
      grouped = Hash.new { |h, k| h[k] = [] }
      docs.each do |doc|
        Array(doc.data["categories"]).each do |category|
          grouped[category] << doc
        end
      end

      grouped.each do |category, items|
        slug = Utils.slugify(category, :mode => "default")
        dir = File.join("articles", "categories", slug)
        site.pages << ArticlesCategoryPage.new(site, site.source, dir, category, items)
      end
    end

    def generate_tags(site, docs)
      grouped = Hash.new { |h, k| h[k] = [] }
      docs.each do |doc|
        Array(doc.data["tags"]).each do |tag|
          grouped[tag] << doc
        end
      end

      grouped.each do |tag, items|
        slug = Utils.slugify(tag, :mode => "default")
        dir = File.join("articles", "tags", slug)
        site.pages << ArticlesTagPage.new(site, site.source, dir, tag, items)
      end
    end
  end
end
