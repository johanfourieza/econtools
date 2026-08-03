# LEAP graph style

Use this reference for R and `ggplot2` figures. The purpose is a recognisable, restrained visual identity that remains legible in papers, slides and grayscale reproduction.

## Contents

1. Defaults
2. Palette
3. Theme and saving helpers
4. Graph construction
5. Conversion rules
6. Validation
7. Examples

## 1. Defaults

- Preferred package: `ggplot2`.
- Default typeface: a widely available sans-serif face; do not introduce a fragile font dependency.
- Default figure size: 10 by 6 inches.
- Default raster resolution: 600 dpi.
- Default background: white.
- Default output: vector PDF for papers plus high-resolution PNG when convenient.
- Default legend position: bottom, unless direct labels or a side legend materially improve comparison.
- Default title alignment: left.

Adapt dimensions to the destination. A one-column paper figure is narrower; a presentation figure needs larger labels. Keep a common visual grammar across a project.

## 2. Palette

```r
leap_colours <- c(
  plum   = "#5C2346",
  blue   = "#3D8EB9",
  sage   = "#6B8E5E",
  gold   = "#D4A03E",
  rose   = "#A34466",
  teal   = "#45808B",
  earth  = "#8B6B3D",
  mint   = "#97C5B0",
  maroon = "#7A0019",
  grey   = "#AAAAAA"
)
```

Use maroon or plum for emphasis, blue and sage for primary contrasts and the remaining colours for additional categories. Grey is for reference information, uncertainty backgrounds or de-emphasised series.

Do not use every colour merely because it is available. Two or three well-separated colours are usually enough. Check that meaning does not depend on colour alone: combine colour with line type, shape, labels or faceting where necessary.

## 3. Theme and saving helpers

```r
library(ggplot2)

theme_leap <- function(base_size = 12, base_family = "sans") {
  theme_minimal(base_size = base_size, base_family = base_family) +
    theme(
      plot.title.position = "plot",
      plot.caption.position = "plot",
      plot.title = element_text(
        colour = leap_colours[["maroon"]],
        face = "bold",
        size = rel(1.15),
        margin = margin(b = 7)
      ),
      plot.subtitle = element_text(
        colour = "grey25",
        margin = margin(b = 10)
      ),
      plot.caption = element_text(
        colour = "grey35",
        hjust = 0,
        size = rel(0.8),
        margin = margin(t = 8)
      ),
      axis.title = element_text(colour = "grey20"),
      axis.text = element_text(colour = "grey25"),
      panel.grid.major.x = element_blank(),
      panel.grid.minor = element_blank(),
      panel.grid.major.y = element_line(colour = "grey88", linewidth = 0.3),
      legend.position = "bottom",
      legend.title = element_blank(),
      legend.key = element_blank(),
      strip.text = element_text(face = "bold", colour = "grey20"),
      strip.background = element_rect(fill = "grey94", colour = NA),
      plot.margin = margin(10, 14, 10, 10)
    )
}

scale_colour_leap <- function(...) {
  scale_colour_manual(values = leap_colours, ...)
}

scale_fill_leap <- function(...) {
  scale_fill_manual(values = leap_colours, ...)
}

save_leap <- function(filename, plot = last_plot(), width = 10, height = 6,
                      dpi = 600, bg = "white", ...) {
  ggsave(
    filename = filename,
    plot = plot,
    width = width,
    height = height,
    dpi = dpi,
    bg = bg,
    ...
  )
}
```

If the installed `ggplot2` version rejects `linewidth`, use the equivalent `size` argument. Preserve compatibility with the project's environment rather than upgrading packages solely for style.

## 4. Graph construction

### Titles and annotations

Use an informative title that states what the reader is looking at. Use the subtitle for the sample, comparison or identification detail. Put source and necessary notes in the caption.

Annotations should direct attention to a genuine feature of the data. Avoid arrows and labels that merely decorate obvious points.

### Axes

- Name the measured quantity and unit.
- Use meaningful tick intervals and human-readable labels.
- Keep a zero baseline when bar length encodes magnitude.
- Do not truncate an axis in a way that exaggerates differences.
- Avoid dual axes unless the transformation is explicit, necessary and easy to verify.
- Order categories substantively rather than alphabetically when comparison improves.

### Uncertainty

Show uncertainty when the inference depends on it. Use intervals, ribbons or distributions rather than leaving the reader to infer precision from point estimates. State the interval level in the legend, subtitle or note.

### Lines and points

Use line width and point size that survive reduction. Avoid smoothing unless the method is stated and substantively justified. Distinguish observed data from fitted values.

### Facets

Prefer small multiples to crowded overlays. Keep comparable scales across facets unless free scales are essential and clearly marked.

### Notes and sources

Include data provenance and transformations needed to interpret the graph. A figure must not rely on the surrounding paragraph to disclose a restricted sample, index normalisation or logarithmic scale.

## 5. Conversion rules

When restyling an existing graph:

1. Read the code and the resulting figure before editing.
2. Preserve the data, filters, transformations, estimand, geometry, labels and uncertainty unless the user asks for an analytical change.
3. Separate style changes from analytical changes in the diff.
4. Replace ad hoc colours with the LEAP palette.
5. Apply `theme_leap()` and then make only destination-specific adjustments.
6. Improve titles, units and notes when their meaning is already supported by the code or source.
7. Do not silently change scales, baselines, bin widths, smoothing, model specifications or category order when order has substantive meaning.
8. Save to a new file during conversion unless overwriting is explicitly requested.

## 6. Validation

Run the graph code in the project's environment. Then check:

- the code completes without warnings that affect the output;
- the output file exists at the expected dimensions and resolution;
- title, subtitle, axes, units, legend and source note are correct;
- colours are distinguishable and meaning does not rely on hue alone;
- labels remain legible at the intended printed or projected size;
- no observations, intervals or panels were lost during restyling;
- analytical quantities match the source graph;
- the graph works in grayscale when likely to be printed that way.

Inspect the rendered file, not only the code.

## 7. Examples

### Point estimates with confidence intervals

```r
p <- ggplot(estimates, aes(term, estimate, colour = model)) +
  geom_hline(yintercept = 0, colour = "grey70", linewidth = 0.4) +
  geom_pointrange(
    aes(ymin = conf.low, ymax = conf.high),
    position = position_dodge(width = 0.45),
    linewidth = 0.45
  ) +
  coord_flip() +
  scale_colour_manual(values = c(
    "Baseline" = leap_colours[["blue"]],
    "Preferred" = leap_colours[["plum"]]
  )) +
  labs(
    title = "The preferred estimate is smaller and more precise",
    subtitle = "Points are coefficients; lines are 95% confidence intervals",
    x = NULL,
    y = "Estimated effect",
    caption = "Source: Author's calculations."
  ) +
  theme_leap()

save_leap("figures/estimates.png", p)
ggsave("figures/estimates.pdf", p, width = 10, height = 6, bg = "white")
```

### Time series

```r
p <- ggplot(series, aes(year, value, colour = group, linetype = group)) +
  geom_line(linewidth = 0.8) +
  scale_colour_manual(values = c(
    "Observed" = leap_colours[["plum"]],
    "Comparison" = leap_colours[["blue"]]
  )) +
  labs(
    title = "The two series diverge after the intervention",
    x = NULL,
    y = "Outcome (index, 2010 = 100)",
    caption = "Source: Dataset name. The index is normalised to 100 in 2010."
  ) +
  theme_leap()

save_leap("figures/series.png", p)
```
