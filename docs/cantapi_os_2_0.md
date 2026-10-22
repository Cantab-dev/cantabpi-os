# Cantab OS v2

## Purpose

The purpose of Cantab OS v2 is to build a semi-functional mockup for a consulting OS. The key principles & changes

* Implement 8-10 new views, which show partially 'dummy' data for different steps of a consulting workstream.

* Add 'Project' dimension to data

* Adapt tools

* Build dummy data for each view. 

* Polish the views.

## Projects

* Add 'Projects' table (id, label, name, user, icon)
* Add project to 'list' tool
* Add select project tool (changes project by selecting ID)
* Add mcp widgets to the tool as for 'aleph'
* Tools for view doc, sheet, ppt view only documents for the selected project

## Views

We need to implement the following views

* Engagement starter
* Analyst
* Value calculator
* Presentation builder
* Project Manager
* Team manager
* Story builder
* Agent builder
* Proposal builder

Each view will display certain set of (partially dummy) data in a polished environment

## UX/UI for view

* No sidebar (for now)
* Header: Cantab OS | Name of view | Icons for available views 
* Centerpane - displayed default data
* Each view (for Cantab OS, for a single mockup project only) displays a fixed data set (or document)
* Some of this data set can be changed by an agent. TBD on a case to case basis

# Views

## Engagement starter

* Displays 'RACI matrix' and 'Project outline' dashboard (simplified gannt chart - phases, )
* Raci structure
    * Team member (fk_id)
    * Phase (fk_id)
    * Role (enum) (R/A/C/I)
* Project outline
    * Phase
    * Starts at
    * Finishes at
    * TBD (pls suggest)

## Analyst

* Displays excel file
* Pls propose non-ugly way to display excel (i.e. not google sheet)

## Value calculator

* Displays 




