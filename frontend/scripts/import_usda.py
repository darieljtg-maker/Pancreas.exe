"""Build the local, attributed catalog from USDA SR Legacy CSV files.

Usage: python scripts/import_usda.py /path/to/extracted/csv
Source: https://fdc.nal.usda.gov/download-datasets/
Release: SR Legacy April 2018. Nutrient values refer to 100 g edible portion.
No patient data or API key is needed.
"""
import csv
import json
import pathlib
import sys

root = pathlib.Path(sys.argv[1])
foods = {r['fdc_id']: r for r in csv.DictReader((root / 'food.csv').open(encoding='utf-8-sig'))}
nutrients = {}
keys = {'1003': 'protein', '1004': 'fat', '1005': 'carbs', '1008': 'kcal', '1079': 'fiber', '2000': 'sugars'}
for row in csv.DictReader((root / 'food_nutrient.csv').open(encoding='utf-8-sig')):
    if row['nutrient_id'] in keys and row['amount'] != '':
        nutrients.setdefault(row['fdc_id'], {})[keys[row['nutrient_id']]] = float(row['amount'])

# Spanish names are aliases for exact source records, not substituted foods.
aliases = [
    (173241, 'Tortilla de maíz sin sal añadida', 'carbohidrato', 'Lista para calentar; revisa la etiqueta si es de marca'),
    (169704, 'Arroz integral cocido', 'carbohidrato', 'Peso cocido'),
    (168878, 'Arroz blanco cocido', 'carbohidrato', 'Peso cocido'),
    (173904, 'Avena en hojuelas seca', 'carbohidrato', 'Peso seco; sin endulzar'),
    (173905, 'Avena cocida en agua', 'carbohidrato', 'Peso cocido; sin endulzar'),
    (173735, 'Frijoles negros cocidos', 'carbohidrato', 'Cocidos, sin sal ni grasa añadida'),
    (175200, 'Frijoles pintos cocidos', 'carbohidrato', 'Cocidos, sin sal ni grasa añadida'),
    (172421, 'Lentejas cocidas', 'carbohidrato', 'Cocidas y escurridas, sin sal'),
    (173757, 'Garbanzos cocidos', 'carbohidrato', 'Cocidos y escurridos, sin sal'),
    (168917, 'Quinoa cocida', 'carbohidrato', 'Peso cocido'),
    (168910, 'Pasta integral cocida', 'carbohidrato', 'Peso cocido'),
    (168483, 'Camote horneado', 'carbohidrato', 'Pulpa horneada sin sal'),
    (170440, 'Papa cocida sin piel', 'carbohidrato', 'Cocida sin sal'),
    (169999, 'Elote amarillo cocido', 'carbohidrato', 'Granos cocidos, sin sal'),
    (173424, 'Huevo entero cocido', 'proteína', 'Hervido; pesar sin cáscara'),
    (171477, 'Pechuga de pollo asada', 'proteína', 'Carne cocida, sin piel ni huesos'),
    (171496, 'Pechuga de pavo asada', 'proteína', 'Carne cocida, sin piel'),
    (172170, 'Res magra de sirloin a la parrilla', 'proteína', 'Carne cocida sin grasa separable'),
    (168250, 'Lomo de cerdo magro asado', 'proteína', 'Carne cocida sin grasa separable'),
    (171998, 'Salmón salvaje cocido', 'proteína', 'Cocido con calor seco'),
    (173709, 'Atún en agua escurrido', 'proteína', 'Peso escurrido'),
    (172475, 'Tofu firme', 'proteína', 'Sin cocinar; preparado con sulfato de calcio'),
    (170894, 'Yogur griego natural sin grasa', 'lácteo', 'Sin endulzar; coteja marca y etiqueta'),
    (170903, 'Yogur griego natural bajo en grasa', 'lácteo', 'Sin endulzar; coteja marca y etiqueta'),
    (171267, 'Leche semidescremada 2%', 'lácteo', 'Peso en gramos; sin azúcar añadida'),
    (169967, 'Brócoli cocido', 'verdura', 'Hervido y escurrido, sin sal'),
    (170397, 'Coliflor cocida', 'verdura', 'Hervida y escurrida, sin sal'),
    (169292, 'Calabacita cocida', 'verdura', 'Con piel, hervida sin sal'),
    (168462, 'Espinaca cruda', 'verdura', 'Parte comestible cruda'),
    (168463, 'Espinaca cocida', 'verdura', 'Hervida y escurrida sin sal'),
    (168409, 'Pepino con cáscara', 'verdura', 'Crudo'),
    (170457, 'Jitomate crudo', 'verdura', 'Tomate rojo maduro'),
    (170393, 'Zanahoria cruda', 'verdura', 'Parte comestible cruda'),
    (169247, 'Lechuga romana cruda', 'verdura', 'Parte comestible cruda'),
    (170108, 'Pimiento rojo crudo', 'verdura', 'Parte comestible cruda'),
    (169975, 'Col cruda', 'verdura', 'Parte comestible cruda'),
    (169141, 'Ejotes cocidos', 'verdura', 'Hervidos y escurridos sin sal'),
    (169252, 'Champiñones cocidos', 'verdura', 'Hervidos y escurridos sin sal'),
    (170420, 'Chícharos cocidos', 'carbohidrato', 'Hervidos y escurridos sin sal'),
    (171705, 'Aguacate', 'grasa', 'Pulpa cruda, sin piel ni hueso'),
    (171413, 'Aceite de oliva', 'grasa', 'Gramos de aceite usado'),
    (170567, 'Almendras naturales', 'grasa', 'Sin sal ni endulzantes'),
    (173806, 'Cacahuates tostados sin sal', 'grasa', 'Tostados en seco'),
    (170554, 'Chía seca', 'grasa', 'Semillas secas'),
    (170188, 'Semillas de calabaza tostadas', 'grasa', 'Enteras, sin sal'),
    (171688, 'Manzana con cáscara', 'fruta', 'Cruda, sin corazón'),
    (173944, 'Plátano', 'fruta', 'Crudo y sin cáscara'),
    (167762, 'Fresas', 'fruta', 'Crudas; sin hojas'),
    (169097, 'Naranja', 'fruta', 'Pulpa cruda, no jugo'),
    (167776, 'Pera Bartlett', 'fruta', 'Cruda; parte comestible'),
    (169926, 'Papaya', 'fruta', 'Pulpa cruda sin semillas'),
    (169092, 'Melón cantalupo', 'fruta', 'Pulpa cruda sin semillas'),
    (169124, 'Piña', 'fruta', 'Pulpa cruda'),
    (167765, 'Sandía', 'fruta', 'Pulpa cruda'),
]
out = []
for ident, name, group, preparation in aliases:
    key = str(ident)
    n = nutrients[key]
    assert all(k in n for k in ('carbs', 'protein', 'fat', 'kcal')), key
    out.append({'id': ident, 'name': name, 'group': group, 'preparation': preparation,
                'description': foods[key]['description'], 'per100g': n,
                'source': 'USDA FoodData Central · SR Legacy 04/2018',
                'url': f'https://fdc.nal.usda.gov/food-details/{key}/nutrients'})
dest = pathlib.Path(__file__).resolve().parents[1] / 'lib' / 'alimentos.json'
dest.write_text(json.dumps(out, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(f'{len(out)} alimentos con valores oficiales y trazabilidad: {dest}')
