-- =============================================================================
-- Calendrier Sport — Catalogue d'exercices de base
-- (created_by NULL = exercice prédéfini, non supprimable depuis l'application)
-- =============================================================================

INSERT INTO exercise_catalog (name, category, muscle_group) VALUES
    -- Pectoraux
    ('Développé couché',                'Barre',          'Pectoraux'),
    ('Développé incliné',               'Barre',          'Pectoraux'),
    ('Développé décliné',               'Barre',          'Pectoraux'),
    ('Développé couché haltères',       'Haltères',       'Pectoraux'),
    ('Développé incliné haltères',      'Haltères',       'Pectoraux'),
    ('Écarté couché haltères',          'Haltères',       'Pectoraux'),
    ('Écarté à la poulie (vis-à-vis)',  'Poulie',         'Pectoraux'),
    ('Pec deck',                        'Machine',        'Pectoraux'),
    ('Développé machine convergente',   'Machine',        'Pectoraux'),
    ('Pompes',                          'Poids du corps', 'Pectoraux'),
    ('Dips',                            'Poids du corps', 'Pectoraux'),

    -- Dos
    ('Soulevé de terre',                'Barre',          'Dos'),
    ('Rowing barre',                    'Barre',          'Dos'),
    ('Rowing Pendlay',                  'Barre',          'Dos'),
    ('Rowing haltère un bras',          'Haltères',       'Dos'),
    ('Tractions',                       'Poids du corps', 'Dos'),
    ('Tractions supination (chin-up)',  'Poids du corps', 'Dos'),
    ('Tirage vertical (lat pulldown)',  'Poulie',         'Dos'),
    ('Tirage horizontal (rowing assis)','Poulie',         'Dos'),
    ('Pull-over poulie',                'Poulie',         'Dos'),
    ('Rowing machine (T-bar)',          'Machine',        'Dos'),
    ('Shrugs haltères',                 'Haltères',       'Dos'),
    ('Extensions lombaires',            'Poids du corps', 'Dos'),

    -- Épaules
    ('Développé militaire',             'Barre',          'Épaules'),
    ('Développé haltères assis',        'Haltères',       'Épaules'),
    ('Développé Arnold',                'Haltères',       'Épaules'),
    ('Élévations latérales',            'Haltères',       'Épaules'),
    ('Élévations latérales poulie',     'Poulie',         'Épaules'),
    ('Oiseau (élévations postérieures)','Haltères',       'Épaules'),
    ('Face pull',                       'Poulie',         'Épaules'),
    ('Rowing menton',                   'Barre',          'Épaules'),

    -- Biceps
    ('Curl barre',                      'Barre',          'Biceps'),
    ('Curl barre EZ',                   'Barre',          'Biceps'),
    ('Curl haltères',                   'Haltères',       'Biceps'),
    ('Curl marteau',                    'Haltères',       'Biceps'),
    ('Curl pupitre (Larry Scott)',      'Machine',        'Biceps'),
    ('Curl poulie basse',               'Poulie',         'Biceps'),

    -- Triceps
    ('Barre au front',                  'Barre',          'Triceps'),
    ('Développé couché prise serrée',   'Barre',          'Triceps'),
    ('Extensions triceps poulie haute', 'Poulie',         'Triceps'),
    ('Extension nuque haltère',         'Haltères',       'Triceps'),
    ('Kickback haltère',                'Haltères',       'Triceps'),
    ('Dips entre deux bancs',           'Poids du corps', 'Triceps'),

    -- Avant-bras
    ('Curl poignets',                   'Barre',          'Avant-bras'),
    ('Farmer walk',                     'Haltères',       'Avant-bras'),

    -- Quadriceps
    ('Squat',                           'Barre',          'Quadriceps'),
    ('Squat avant (front squat)',       'Barre',          'Quadriceps'),
    ('Presse à cuisses',                'Machine',        'Quadriceps'),
    ('Hack squat',                      'Machine',        'Quadriceps'),
    ('Leg extension',                   'Machine',        'Quadriceps'),
    ('Fentes haltères',                 'Haltères',       'Quadriceps'),
    ('Squat bulgare',                   'Haltères',       'Quadriceps'),
    ('Goblet squat',                    'Kettlebell',     'Quadriceps'),

    -- Ischio-jambiers
    ('Soulevé de terre jambes tendues', 'Barre',          'Ischio-jambiers'),
    ('Soulevé de terre roumain',        'Barre',          'Ischio-jambiers'),
    ('Leg curl allongé',                'Machine',        'Ischio-jambiers'),
    ('Leg curl assis',                  'Machine',        'Ischio-jambiers'),
    ('Good morning',                    'Barre',          'Ischio-jambiers'),

    -- Fessiers
    ('Hip thrust',                      'Barre',          'Fessiers'),
    ('Soulevé de terre sumo',           'Barre',          'Fessiers'),
    ('Abducteurs machine',              'Machine',        'Fessiers'),
    ('Kickback fessier poulie',         'Poulie',         'Fessiers'),

    -- Mollets
    ('Mollets debout',                  'Machine',        'Mollets'),
    ('Mollets assis',                   'Machine',        'Mollets'),
    ('Mollets à la presse',             'Machine',        'Mollets'),

    -- Abdominaux
    ('Crunch',                          'Poids du corps', 'Abdominaux'),
    ('Relevés de jambes suspendu',      'Poids du corps', 'Abdominaux'),
    ('Gainage (planche)',               'Poids du corps', 'Abdominaux'),
    ('Crunch poulie haute',             'Poulie',         'Abdominaux'),
    ('Roue abdominale',                 'Autre',          'Abdominaux'),
    ('Russian twist',                   'Poids du corps', 'Abdominaux'),

    -- Corps entier
    ('Kettlebell swing',                'Kettlebell',     'Corps entier'),
    ('Épaulé-jeté',                     'Barre',          'Corps entier'),
    ('Arraché',                         'Barre',          'Corps entier'),
    ('Burpees',                         'Poids du corps', 'Corps entier'),
    ('Thruster',                        'Barre',          'Corps entier'),

    -- Cardio (reps = minutes ou calories selon l'usage, poids = 0)
    ('Rameur',                          'Cardio',         'Cardio'),
    ('Vélo',                            'Cardio',         'Cardio'),
    ('Tapis de course',                 'Cardio',         'Cardio'),
    ('Corde à sauter',                  'Cardio',         'Cardio')
ON CONFLICT DO NOTHING;
