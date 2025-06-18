import json
from collections import defaultdict

with open("data/all_classes.json", "r", encoding="utf-8") as file:
    data = json.load(file)
all_lectures = [entry for entry in data if entry.get("activity_type") == "Lecture"]
print(f'Number of total Lecture courses:{len(all_lectures)}')
schools = ['mgt','ecs','aht','is','nsm','eps','bbs']
for lecture in all_lectures: 
    if lecture['school'] not in schools: 
        schools.append(lecture['school'])
print(f'All schools{schools}')
for school in schools: 
    school_lectures = [
        entry
        for entry in data
        if entry.get("activity_type") == "Lecture"
        and str(entry.get("school", "")).lower() == school
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

    for entry in school_lectures:
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
        course_groups[key]["dept"] = entry["dept"]

    school_courses = []
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
            "dept": details["dept"]
        }
        school_courses.append(course_data)

    school_courses.sort(key=lambda x: (x["course_prefixes"], x["course_number"]))

    with open(f"data/schools/{school}_courses.json", "w", encoding="utf-8") as file:
        json.dump(school_courses, file, indent=4, ensure_ascii=False)

    print(
        f"Processed {len(school_courses)} {school} courses. Results saved to 'data/schools/ecs_courses.json'"
    )
