import json
import os

from collections import defaultdict

school_files = os.listdir("data/alternate_schools")
prefix_dict = {}
for sc_file in school_files: 
    with open(os.path.join("data/alternate_schools",sc_file), "r", encoding="utf-8") as file:
        data = json.load(file) 
    for entry in data: 
        prefixes = entry['course_prefixes']
        for prefix in prefixes: 
            if not prefix_dict.get(prefix): 
                prefix_dict.update({f"{prefix}":sc_file.split("_")[0]})

    
with open(f"data/prefix_map.json", "w", encoding="utf-8") as file:
    json.dump(prefix_dict, file, indent=4, ensure_ascii=False)


print(
    f"Processed all courses and generated prefix_mapping"
)
