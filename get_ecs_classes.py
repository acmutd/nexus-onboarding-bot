import json
from collections import defaultdict

with open("data/all_classes.json", "r", encoding="utf-8") as file:
    data = json.load(file)

ecs_lectures = [
    entry
    for entry in data
    if entry.get("activity_type") == "Lecture"
    and str(entry.get("school", "")).lower() == "ecs"
]

course_groups = defaultdict(
    lambda: {
        "prefixes": set(),
        "sections": set(),
        "enrolled_current": 0,
        "enrolled_max": 0,
        "class_numbers": set(),
        "assistants": set(),
    }
)

for entry in ecs_lectures:
    key = (entry["course_number"].strip(), "".join(sorted(entry["instructors"])))

    course_groups[key]["prefixes"].add(entry["course_prefix"].strip())
    course_groups[key]["sections"].add(str(entry["section"]).strip())
    course_groups[key]["class_numbers"].add(int(entry["class_number"]))
    course_groups[key]["assistants"].update(entry["assistants"].split(", "))

    course_groups[key]["enrolled_current"] += int(entry["enrolled_current"])
    course_groups[key]["enrolled_max"] += int(entry["enrolled_max"])

    course_groups[key]["title"] = entry["title"].strip()
    course_groups[key]["instructors"] = entry["instructors"].split(", ")
    course_groups[key]["course_number"] = entry["course_number"]

ecs_courses = []
for key, details in course_groups.items():
    course_data = {
        "course_number": details["course_number"],
        "course_prefixes": list(sorted(details["prefixes"])),
        "sections": list(sorted(details["sections"])),
        "title": details["title"],
        "instructors": details["instructors"],
        "class_numbers": list(sorted(details["class_numbers"])),
        "enrolled_current": details["enrolled_current"],
        "enrolled_max": details["enrolled_max"],
        "assistants": list(details["assistants"]),
    }
    ecs_courses.append(course_data)

ecs_courses.sort(key=lambda x: (x["course_prefixes"], x["course_number"]))

with open("data/ecs_courses.json", "w", encoding="utf-8") as file:
    json.dump(ecs_courses, file, indent=4, ensure_ascii=False)

print(
    f"Processed {len(ecs_courses)} ECS courses. Results saved to 'data/ecs_courses.json'"
)
