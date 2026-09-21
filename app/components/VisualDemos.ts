/**
 * Sample visual specs for testing InteractiveVisual on any post:
 *   /post/<id>?demo=map      points, hover popups
 *   /post/<id>?demo=chart    line / bar / scatter
 *   /post/<id>?demo=africa   time-series choropleth, 1970–2022, with play/pause
 * Safe to delete once the backend returns a real `visual_spec`.
 *
 * The africa demo reads two files from /public/demo/ (copy them in too):
 *   africa-countries.geojson  country shapes once, each tagged with `iso3`
 *   africa-series.json        long format: one row per country per year
 * Sources: Our World in Data CO₂ dataset (population, CO₂/person, GDP in
 * 2011 international-$) and Natural Earth 1:110m boundaries. Somaliland is
 * merged into Somalia to match OWID; Western Sahara has no data.
 */
import type { VisualSpec } from './InteractiveVisual'

const CITIES: [string, number, number, number, number, number][] = [
  ['Seattle', -122.335, 47.608, 755000, 97185, 8.4],
  ['Portland', -122.676, 45.523, 652000, 78476, 3.1],
  ['San Francisco', -122.419, 37.775, 808000, 136689, 1.2],
  ['Los Angeles', -118.243, 34.052, 3822000, 76135, 0.4],
  ['San Diego', -117.161, 32.716, 1381000, 98657, 2.2],
  ['Phoenix', -112.074, 33.448, 1644000, 72092, 11.3],
  ['Denver', -104.99, 39.739, 713000, 88213, 6.8],
  ['Salt Lake City', -111.891, 40.761, 209000, 73280, 5.4],
  ['Austin', -97.743, 30.267, 979000, 89415, 15.2],
  ['Dallas', -96.797, 32.777, 1299000, 63985, 6.1],
  ['Houston', -95.369, 29.76, 2302000, 60440, 4.9],
  ['Chicago', -87.63, 41.878, 2665000, 71673, -1.8],
  ['Atlanta', -84.388, 33.749, 499000, 77655, 9.7],
  ['Miami', -80.192, 25.762, 455000, 54858, 7.3],
  ['New York', -74.006, 40.713, 8336000, 76607, -2.4],
  ['Boston', -71.058, 42.36, 654000, 89212, 1.6],
]

const MONTHS: [string, number, number, number][] = [
  ['Jan', 42000, 610, 4.1], ['Feb', 38500, 548, 3.8], ['Mar', 51200, 742, 4.4],
  ['Apr', 47800, 690, 4.2], ['May', 63400, 905, 4.9], ['Jun', 71900, 1024, 5.3],
  ['Jul', 68300, 972, 5.0], ['Aug', 74600, 1088, 5.4], ['Sep', 82100, 1180, 5.8],
  ['Oct', 79400, 1142, 5.6], ['Nov', 91300, 1305, 6.2], ['Dec', 88700, 1261, 6.0],
]

export type DemoKind = 'map' | 'chart' | 'africa'

export const DEMO_SPECS: Record<DemoKind, VisualSpec> = {
  map: {
    kind: 'map',
    value_field: 'population',
    label_field: 'name',
    fields: ['population', 'median_income', 'growth_pct'],
    data: {
      type: 'FeatureCollection',
      features: CITIES.map(([name, lon, lat, population, median_income, growth_pct]) => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [lon, lat] },
        properties: { name, population, median_income, growth_pct },
      })),
    },
  },
  chart: {
    kind: 'chart',
    chart_type: 'line',
    allowed_types: ['line', 'bar', 'scatter'],
    x: 'month',
    y: 'revenue',
    fields: ['revenue', 'orders', 'conversion_pct'],
    data: MONTHS.map(([month, revenue, orders, conversion_pct]) => ({ month, revenue, orders, conversion_pct })),
  },
  africa: {
    kind: 'map',
    value_field: 'population',
    label_field: 'name',
    fields: ['population', 'gdp_per_capita', 'co2_per_capita'],
    data: '/demo/africa-countries.geojson',
    time: {
      field: 'year',
      join: 'iso3',
      series: '/demo/africa-series.json',
      interval_ms: 350,
    },
  },
}