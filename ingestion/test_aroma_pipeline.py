"""Invariants that protect missingness, identities and compositional arithmetic."""
import json
import unittest
from pathlib import Path
from generate_aroma_fingerprints import families, VOCAB
from ingest_compound_overlap import load_spices
ROOT=Path(__file__).resolve().parent.parent
class AromaPipelineTests(unittest.TestCase):
 def test_descriptor_mapping_uses_tokens(self):
  self.assertIn('citrus',families('fresh lemon'))
  self.assertNotIn('fatty-waxy',families('boiling'))
  self.assertEqual(families('odorless'),[])
 def test_complete_taxonomy_keys_and_explicit_missingness(self):
  rows=json.loads((ROOT/'src/data/aroma-fingerprints.json').read_text())
  self.assertEqual(set(rows),{s['id'] for s in load_spices()})
  for r in rows.values():
   if r['missing']:
    self.assertIsNone(r['vector']);self.assertEqual(r['sourceQuality'],'none')
   else:
    self.assertEqual(set(r['vector']),set(VOCAB));self.assertAlmostEqual(sum(r['vector'].values()),1,places=6)
    self.assertGreater(r['mappedMoleculeCount'],0)
    self.assertGreaterEqual(r['moleculeCount'],r['annotatedMoleculeCount'])
 def test_cuisine_denominators(self):
  d=json.loads((ROOT/'src/data/cuisine-frequencies.json').read_text())
  self.assertEqual(sum(d['cuisineTotals'].values()),d['recipeCount'])
  self.assertEqual(set(d['spices']),{s['id'] for s in load_spices()})
  for row in d['spices'].values():
   for c in row['cuisines']:
    self.assertLessEqual(c['recipeCount'],c['totalRecipes'])
    self.assertAlmostEqual(c['frequency'],c['recipeCount']/c['totalRecipes'],places=6)
if __name__=='__main__':unittest.main()
