module Jekyll
  class BooksCategoryPage < Page
    def initialize(site, base, dir, category, posts)
      @site = site
      @base = base
      @dir  = dir
      @name = "index.html"

      self.process(@name)
      self.read_yaml(File.join(base, "_layouts"), "category.html")
      self.data["title"] = category
      self.data["category"] = category
      self.data["posts"] = posts
      self.data["collection"] = "books"
      self.data["layout"] = "category"
      self.data["permalink"] = File.join("/", dir, "/")
    end
  end

  class BooksTagPage < Page
    def initialize(site, base, dir, tag, posts)
      @site = site
      @base = base
      @dir  = dir
      @name = "index.html"

      self.process(@name)
      self.read_yaml(File.join(base, "_layouts"), "tag.html")
      self.data["title"] = tag
      self.data["tag"] = tag
      self.data["posts"] = posts
      self.data["collection"] = "books"
      self.data["layout"] = "tag"
      self.data["permalink"] = File.join("/", dir, "/")
    end
  end

  class BooksTaxonomyGenerator < Generator
    safe true
    priority :low

    def generate(site)
      books = site.collections["books"]&.docs || []
      return if books.empty?

      build_categories(site, books)
      build_tags(site, books)
    end

    private

    def build_categories(site, books)
      grouped = Hash.new { |h, k| h[k] = [] }
      books.each do |doc|
        Array(doc.data["categories"]).each do |category|
          grouped[category] << doc
        end
      end

      grouped.each do |category, docs|
        slug = Utils.slugify(category, :mode => "default")
        dir = File.join("books", "categories", slug)
        site.pages << BooksCategoryPage.new(site, site.source, dir, category, docs)
      end
    end

    def build_tags(site, books)
      grouped = Hash.new { |h, k| h[k] = [] }
      books.each do |doc|
        Array(doc.data["tags"]).each do |tag|
          grouped[tag] << doc
        end
      end

      grouped.each do |tag, docs|
        slug = Utils.slugify(tag, :mode => "default")
        dir = File.join("books", "tags", slug)
        site.pages << BooksTagPage.new(site, site.source, dir, tag, docs)
      end
    end
  end
end
