# workflow

## before having plan md file
- clear task
- model => opus 4.8
- install plugin "superpowers"
- shift + tab => plan mode
- prompt
example:
"""
Use /superpowers:writing-plans 
- Read @STATUS.md, @plan.md  
- Improve plan, make it better
- Add more exercises
- Write that plan into md file
- No execute code or something
"""
- write plan into md file
- clear task

## after having plan md file
- shift + tab => auto-mode
- model => sonnet 4.6
- prompt
"""
- base on @plan.md implement
- run 1 sub agent task
- never run multiple agent in parallel
- only run sequentially
"""
- clear task
