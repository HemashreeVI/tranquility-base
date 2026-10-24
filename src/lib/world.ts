import type {Feature, FeatureCollection, Geometry, MultiLineString} from 'geojson';
import {feature, mesh} from 'topojson-client';
import type {GeometryCollection, Topology} from 'topojson-specification';
import world from 'world-atlas/countries-110m.json';

/** Real country outlines (Natural Earth 1:110m), shared by every globe on the page. */

type Props = {name: string};
const topo = world as unknown as Topology<{countries: GeometryCollection<Props>; land: GeometryCollection}>;

export const countries = (feature(topo, topo.objects.countries) as FeatureCollection<Geometry, Props>).features as Feature<Geometry, Props>[];
export const land = feature(topo, topo.objects.land);
export const borders = mesh(topo, topo.objects.countries, (a, b) => a !== b) as MultiLineString;

export const byIso = new Map(countries.map((c) => [String(c.id), c]));
