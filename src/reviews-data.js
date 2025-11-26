---
layout: null
permalink: /src/reviews-data.js
---
window.REVIEWS = [
{%- assign posts_sorted = site.posts | sort: "date" | reverse -%}
{%- for post in posts_sorted -%}
  {
    title: {{ post.title | jsonify }},
    author: {{ post.author | jsonify }},
    date: "{{ post.date | date_to_xmlschema }}",
    permalink: {{ post.url | relative_url | jsonify }},
    filename: {{ post.path | split: "/" | last | jsonify }},
    publication_year: {{ post.publication_year | default: post.publicationYear | jsonify }},
    summary_year: {{ post.summary_year | default: post.summaryYear | jsonify }},
    detail: {{ post.detail | default: false | jsonify }}
  }{% unless forloop.last %},{% endunless %}
{%- endfor -%}
];
