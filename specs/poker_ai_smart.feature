@vision @poker @ai
Feature: Smart AI Poker Player
  Uses YOLO detection + LLM to play poker intelligently
  Detects cards, analyzes hand strength, and makes strategic decisions

  @smart
  Scenario: AI plays 10 intelligent poker hands
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
    # AI will play 10 hands using vision + LLM
    When AI plays poker hand 1
    And AI plays poker hand 2
    And AI plays poker hand 3
    And AI plays poker hand 4
    And AI plays poker hand 5
    And AI plays poker hand 6
    And AI plays poker hand 7
    And AI plays poker hand 8
    And AI plays poker hand 9
    And AI plays poker hand 10
    Then I should see text "YOU"

