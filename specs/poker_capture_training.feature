@training @poker
Feature: Capture Poker Training Data
  Play poker hands while capturing screenshots for YOLO training
  
  Scenario: Capture 20 hands of training data
    Given I am on the login page
    When I type "demo" into "login_username"
    And I type "pw" into "login_password"
    And I tap "login_button"
    Then I should see text "Casino Lobby"
    When I scroll down
    And I scroll down
    Then I should see text "Poker Table"
    When I tap "poker_table_play_button"
    Then I should see text "DEAL"
    # Capture training data for 20 hands
    When AI captures training data for 20 hands
    Then I should see text "YOU"

