require "json"

module Jekyll
  # Builds a valid JSON index for SimpleJekyllSearch.
  class SearchJsonGenerator < Generator
    safe true
    priority :lowest

    TARGET_PATH = File.join("assets", "js", "data", "search.json").freeze
    COLLECTIONS = %w[posts articles books].freeze

    def generate(site)
      payload = build_payload(site)
      write_json(site, payload)
    end

    private

    def build_payload(site)
      COLLECTIONS.flat_map { |name| docs_for(site, name) }.map do |doc|
        {
          "title" => doc.data["title"].to_s,
          "url" => doc.url,
          "categories" => Array(doc.data["categories"]).join(", "),
          "tags" => Array(doc.data["tags"]).join(", "),
          "date" => doc.data["date"].to_s,
          "content" => clean_content(doc.content)
        }
      end
    end

    def docs_for(site, collection_name)
      docs =
        if collection_name == "posts"
          site.posts.docs
        else
          site.collections[collection_name]&.docs || []
        end

      docs.reject { |d| d.data["hidden"] || d.data["search_exclude"] }
    end

    def clean_content(content)
      stripped = content.gsub(%r!<[^>]*>!, " ") # strip html
      stripped.gsub(/\s+/, " ").strip
    end

    def write_json(site, payload)
      dir = File.dirname(TARGET_PATH)
      name = File.basename(TARGET_PATH)

      # Remove any existing pages targeting the same path to avoid conflicts (theme/polyglot duplicates)
      site.pages.reject! do |p|
        p.url == "/" + TARGET_PATH || (p.url&.end_with?(TARGET_PATH))
      end

      page = PageWithoutAFile.new(site, site.source, dir, name)
      page.content = JSON.generate(payload)
      page.data["layout"] = nil
      page.data["polyglot"] = { "exclude" => true } if site.config["plugins"]&.include?("jekyll-polyglot")
      page.data["lang"] = site.config["default_lang"]

      site.pages << page
    end
  end
end
