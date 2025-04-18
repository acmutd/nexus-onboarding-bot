
# I made this from the original nexus webscraper, it works i think lol.



# from selenium import webdriver
# from selenium.webdriver.common.by import By
# from selenium.webdriver.support.ui import WebDriverWait
# from selenium.webdriver.support import expected_conditions as EC
# from selenium.webdriver.chrome.options import Options
# from flask import Flask, jsonify
# from flask_cors import CORS

# class BrowserSession:
#     def __init__(self):
#         chrome_options = Options()
#         # chrome_options.add_argument("--headless")
#         chrome_options.add_argument("--disable-gpu")
#         chrome_options.add_argument("--no-sandbox")
#         self.driver = webdriver.Chrome(options=chrome_options)

#     def close_driver(self):
#         if self.driver:
#             self.driver.quit()

# def get_courses_info(driver):
#     """Extract course IDs and names from the Blackboard page"""
#     course_ids = []
    
#     # Wait for course elements to load
#     WebDriverWait(driver, 20).until(
#         EC.presence_of_element_located((By.CLASS_NAME, 'multi-column-course-id'))
#     )
    
#     course_elements = driver.find_elements(By.CLASS_NAME, 'multi-column-course-id')
    
#     for element in course_elements:
#         course_text = element.text.strip()
#         if course_text:
#             # Extract course ID from the text
#             # example test: 2252-UTDAL-CS-4349-SEC006-22642
#             course_id = course_text.split("-")[-1]
#             if course_id.isdigit():
#                 course_ids.append(course_id)
    
#     print(f"Found {len(course_ids)} courses")
#     return course_ids

# def scrape_courses(bb_url='https://elearning.utdallas.edu/ultra/course'):
#     browser = BrowserSession()
#     try:
#         browser.driver.get(bb_url)
        
#         while not browser.driver.title.startswith('Institution Page'):
#             pass
            
#         browser.driver.get("https://elearning.utdallas.edu/ultra/course")
        
#         return get_courses_info(browser.driver)
        
#     finally:
#         browser.driver.get("https://elearning.utdallas.edu/ultra/logout")
#         browser.close_driver()

# app = Flask(__name__)
# CORS(app, origins="*")

# @app.route('/scrape', methods=['GET'])
# def run_scraper():
#     courses = scrape_courses()
#     return jsonify({'courses': courses}), 200

# if __name__ == '__main__':
#     app.run(host='127.0.0.1', port=3030)